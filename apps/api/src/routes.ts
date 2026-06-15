import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { pool } from "./db.js";
import { fetchThirdPartyRecommendation, toRecommendation } from "./recommendations.js";
import { fittingInputSchema, type DenimRecommendation, type FittingInput, type FittingSession } from "./types.js";

const fitPreferenceEnum = ["skinny", "slim", "straight", "relaxed", "wide"] as const;
const stretchPreferenceEnum = ["rigid", "comfort-stretch", "high-stretch"] as const;

const fittingInputJsonSchema = {
  type: "object",
  required: [
    "customerName",
    "heightInches",
    "waistInches",
    "hipInches",
    "inseamInches",
    "fitPreference",
    "stretchPreference"
  ],
  properties: {
    customerName: { type: "string", minLength: 1, maxLength: 120 },
    heightInches: { type: "integer", minimum: 48, maximum: 90 },
    waistInches: { type: "number", minimum: 20, maximum: 70 },
    hipInches: { type: "number", minimum: 28, maximum: 80 },
    inseamInches: { type: "number", minimum: 20, maximum: 40 },
    fitPreference: { type: "string", enum: fitPreferenceEnum },
    stretchPreference: { type: "string", enum: stretchPreferenceEnum }
  }
} as const;

const fittingSessionJsonSchema = {
  allOf: [
    fittingInputJsonSchema,
    {
      type: "object",
      required: ["id", "createdAt"],
      properties: {
        id: { type: "string", format: "uuid" },
        createdAt: { type: "string", format: "date-time" }
      }
    }
  ]
} as const;

const recommendationJsonSchema = {
  type: "object",
  required: ["id", "sessionId", "styleName", "sizeLabel", "confidence", "rationale", "createdAt"],
  properties: {
    id: { type: "string", format: "uuid" },
    sessionId: { type: "string", format: "uuid" },
    styleName: { type: "string" },
    sizeLabel: { type: "string" },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    rationale: { type: "string" },
    createdAt: { type: "string", format: "date-time" }
  }
} as const;

const errorJsonSchema = {
  type: "object",
  properties: {
    message: { type: "string" }
  }
} as const;

function mapSession(row: Record<string, unknown>): FittingSession {
  return {
    id: String(row.id),
    customerName: String(row.customer_name),
    heightInches: Number(row.height_inches),
    waistInches: Number(row.waist_inches),
    hipInches: Number(row.hip_inches),
    inseamInches: Number(row.inseam_inches),
    fitPreference: String(row.fit_preference) as FittingInput["fitPreference"],
    stretchPreference: String(row.stretch_preference) as FittingInput["stretchPreference"],
    createdAt: new Date(String(row.created_at)).toISOString()
  };
}

function mapRecommendation(row: Record<string, unknown>): DenimRecommendation {
  return {
    id: String(row.id),
    sessionId: String(row.session_id),
    styleName: String(row.style_name),
    sizeLabel: String(row.size_label),
    confidence: Number(row.confidence),
    rationale: String(row.rationale),
    createdAt: new Date(String(row.created_at)).toISOString()
  };
}

export async function registerRoutes(app: FastifyInstance) {
  app.get(
    "/health",
    {
      schema: {
        tags: ["health"],
        summary: "Check API health",
        response: {
          200: {
            type: "object",
            required: ["ok"],
            properties: {
              ok: { type: "boolean" }
            }
          }
        }
      }
    },
    async () => ({ ok: true })
  );

  app.get("/api/fitting-sessions", {
    schema: {
      tags: ["fitting-sessions"],
      summary: "List recent fitting sessions",
      response: {
        200: {
          type: "object",
          required: ["sessions"],
          properties: {
            sessions: {
              type: "array",
              items: fittingSessionJsonSchema
            }
          }
        }
      }
    }
  }, async () => {
    const result = await pool.query(`
      SELECT *
      FROM fitting_sessions
      ORDER BY created_at DESC
      LIMIT 50
    `);

    return { sessions: result.rows.map(mapSession) };
  });

  app.get("/api/fitting-sessions/:id", {
    schema: {
      tags: ["fitting-sessions"],
      summary: "Get a fitting session and its recommendations",
      params: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "string", format: "uuid" }
        }
      },
      response: {
        200: {
          type: "object",
          required: ["session", "recommendations"],
          properties: {
            session: fittingSessionJsonSchema,
            recommendations: {
              type: "array",
              items: recommendationJsonSchema
            }
          }
        },
        404: errorJsonSchema
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const session = await pool.query("SELECT * FROM fitting_sessions WHERE id = $1", [id]);

    if (session.rowCount === 0) {
      return reply.code(404).send({ message: "Fitting session not found" });
    }

    const recommendations = await pool.query(
      "SELECT * FROM denim_recommendations WHERE session_id = $1 ORDER BY created_at DESC",
      [id]
    );

    return {
      session: mapSession(session.rows[0]),
      recommendations: recommendations.rows.map(mapRecommendation)
    };
  });

  app.post("/api/fitting-sessions", {
    schema: {
      tags: ["fitting-sessions"],
      summary: "Create a fitting session and recommendation",
      body: fittingInputJsonSchema,
      response: {
        201: {
          type: "object",
          required: ["session", "recommendation"],
          properties: {
            session: fittingSessionJsonSchema,
            recommendation: recommendationJsonSchema
          }
        },
        400: {
          type: "object",
          required: ["message"],
          properties: {
            message: { type: "string" },
            issues: { type: "array" }
          }
        }
      }
    }
  }, async (request, reply) => {
    const parsed = fittingInputSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({ message: "Invalid fitting input", issues: parsed.error.issues });
    }

    const input = parsed.data;
    const sessionId = randomUUID();
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      const sessionResult = await client.query(
        `
          INSERT INTO fitting_sessions (
            id, customer_name, height_inches, waist_inches, hip_inches,
            inseam_inches, fit_preference, stretch_preference
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING *
        `,
        [
          sessionId,
          input.customerName,
          input.heightInches,
          input.waistInches,
          input.hipInches,
          input.inseamInches,
          input.fitPreference,
          input.stretchPreference
        ]
      );

      const thirdParty = await fetchThirdPartyRecommendation(input);
      const recommendation = toRecommendation(sessionId, thirdParty);

      const recommendationResult = await client.query(
        `
          INSERT INTO denim_recommendations (
            id, session_id, style_name, size_label, confidence, rationale, source_payload
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING *
        `,
        [
          recommendation.id,
          sessionId,
          recommendation.styleName,
          recommendation.sizeLabel,
          recommendation.confidence,
          recommendation.rationale,
          JSON.stringify(thirdParty)
        ]
      );

      await client.query("COMMIT");

      return reply.code(201).send({
        session: mapSession(sessionResult.rows[0]),
        recommendation: mapRecommendation(recommendationResult.rows[0])
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  });
}
