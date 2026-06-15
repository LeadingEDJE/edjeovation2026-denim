import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { pool } from "./db.js";
import { fetchThirdPartyRecommendation, toRecommendation } from "./recommendations.js";
import { fittingInputSchema, type DenimRecommendation, type FittingInput, type FittingSession } from "./types.js";

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
  app.get("/health", async () => ({ ok: true }));

  app.get("/api/fitting-sessions", async () => {
    const result = await pool.query(`
      SELECT *
      FROM fitting_sessions
      ORDER BY created_at DESC
      LIMIT 50
    `);

    return { sessions: result.rows.map(mapSession) };
  });

  app.get("/api/fitting-sessions/:id", async (request, reply) => {
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

  app.post("/api/fitting-sessions", async (request, reply) => {
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
