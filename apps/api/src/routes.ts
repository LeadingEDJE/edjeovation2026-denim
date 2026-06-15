import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { pool } from "./db.js";
import {
  fetchThirdPartyOrderHistory,
  fetchThirdPartyRecommendation,
  fetchThirdPartyStylistAvailability,
  fetchThirdPartyStylist,
  fetchThirdPartyStylists,
  ThirdPartyHttpError,
  toRecommendation
} from "./recommendations.js";
import {
  fittingInputSchema,
  type DenimRecommendation,
  type FittingInput,
  type FittingSession,
  type OrderHistoryScenario,
  type StylistAvailabilityStatus,
  type StylistProfile
} from "./types.js";

const fitPreferenceEnum = ["skinny", "slim", "straight", "relaxed", "wide"] as const;
const stretchPreferenceEnum = ["rigid", "comfort-stretch", "high-stretch"] as const;
const orderHistoryScenarioEnum = ["standard", "denim-heavy", "returns", "empty", "error"] as const;
const stylistAvailabilityEnum = ["available", "busy", "offline"] as const;

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

const orderHistoryItemJsonSchema = {
  type: "object",
  required: [
    "sku",
    "productName",
    "category",
    "sizeLabel",
    "fit",
    "wash",
    "quantity",
    "unitPrice",
    "kept",
    "returnReason"
  ],
  properties: {
    sku: { type: "string" },
    productName: { type: "string" },
    category: { type: "string" },
    sizeLabel: { type: "string" },
    fit: { type: "string" },
    wash: { type: "string" },
    quantity: { type: "integer", minimum: 1 },
    unitPrice: { type: "number", minimum: 0 },
    kept: { type: "boolean" },
    returnReason: { anyOf: [{ type: "string" }, { type: "null" }] }
  }
} as const;

const orderHistoryJsonSchema = {
  type: "object",
  required: ["customerId", "scenario", "orders"],
  properties: {
    customerId: { type: "string" },
    scenario: { type: "string", enum: orderHistoryScenarioEnum },
    orders: {
      type: "array",
      items: {
        type: "object",
        required: ["orderId", "orderedAt", "channel", "status", "items"],
        properties: {
          orderId: { type: "string" },
          orderedAt: { type: "string", format: "date-time" },
          channel: { type: "string", enum: ["web", "store", "mobile"] },
          status: { type: "string", enum: ["processing", "delivered", "returned", "exchanged"] },
          items: {
            type: "array",
            items: orderHistoryItemJsonSchema
          }
        }
      }
    }
  }
} as const;

const stylistJsonSchema = {
  type: "object",
  required: [
    "id",
    "displayName",
    "pronouns",
    "title",
    "store",
    "bio",
    "specialties",
    "stylePointOfView",
    "supportedFits",
    "customerSignals",
    "availability",
    "avatarUrl"
  ],
  properties: {
    id: { type: "string" },
    displayName: { type: "string" },
    pronouns: { type: "string" },
    title: { type: "string" },
    store: {
      type: "object",
      required: ["storeId", "name", "city", "state"],
      properties: {
        storeId: { type: "string" },
        name: { type: "string" },
        city: { type: "string" },
        state: { type: "string" }
      }
    },
    bio: { type: "string" },
    specialties: { type: "array", items: { type: "string" } },
    stylePointOfView: { type: "array", items: { type: "string" } },
    supportedFits: { type: "array", items: { type: "string" } },
    customerSignals: { type: "array", items: { type: "string" } },
    availability: {
      type: "object",
      required: ["status", "nextAvailableAt"],
      properties: {
        status: { type: "string", enum: stylistAvailabilityEnum },
        nextAvailableAt: { anyOf: [{ type: "string", format: "date-time" }, { type: "null" }] }
      }
    },
    avatarUrl: { anyOf: [{ type: "string", format: "uri" }, { type: "null" }] }
  }
} as const;

const stylistListJsonSchema = {
  type: "object",
  required: ["stylists"],
  properties: {
    stylists: {
      type: "array",
      items: stylistJsonSchema
    }
  }
} as const;

const stylistAvailabilityJsonSchema = {
  type: "object",
  required: ["store", "timezone", "startDate", "endDate", "days"],
  properties: {
    store: stylistJsonSchema.properties.store,
    timezone: { type: "string" },
    startDate: { type: "string", format: "date" },
    endDate: { type: "string", format: "date" },
    days: {
      type: "array",
      items: {
        type: "object",
        required: ["date", "dayOfWeek", "storeOpen", "openTime", "closeTime", "scheduledStylists"],
        properties: {
          date: { type: "string", format: "date" },
          dayOfWeek: { type: "string" },
          storeOpen: { type: "boolean" },
          openTime: { anyOf: [{ type: "string" }, { type: "null" }] },
          closeTime: { anyOf: [{ type: "string" }, { type: "null" }] },
          scheduledStylists: {
            type: "array",
            items: {
              type: "object",
              required: ["stylistId", "displayName", "role", "shiftStart", "shiftEnd"],
              properties: {
                stylistId: { type: "string" },
                displayName: { type: "string" },
                role: { type: "string" },
                shiftStart: { type: "string", format: "date-time" },
                shiftEnd: { type: "string", format: "date-time" }
              }
            }
          }
        }
      }
    }
  }
} as const;

function filterStylists(
  stylists: StylistProfile[],
  filters: { specialty?: string; fit?: string; availability?: StylistAvailabilityStatus }
) {
  return stylists.filter((stylist) => {
    const specialtyMatch = filters.specialty ? stylist.specialties.includes(filters.specialty) : true;
    const fitMatch = filters.fit ? stylist.supportedFits.includes(filters.fit) : true;
    const availabilityMatch = filters.availability ? stylist.availability.status === filters.availability : true;

    return specialtyMatch && fitMatch && availabilityMatch;
  });
}

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

  app.get("/api/customers/:customerId/order-history", {
    schema: {
      tags: ["order-history"],
      summary: "Get customer order history from the simulated third-party service",
      params: {
        type: "object",
        required: ["customerId"],
        properties: {
          customerId: { type: "string", minLength: 1 }
        }
      },
      querystring: {
        type: "object",
        properties: {
          scenario: { type: "string", enum: orderHistoryScenarioEnum, default: "standard" }
        }
      },
      response: {
        200: orderHistoryJsonSchema,
        502: errorJsonSchema
      }
    }
  }, async (request, reply) => {
    const { customerId } = request.params as { customerId: string };
    const { scenario = "standard" } = request.query as { scenario?: OrderHistoryScenario };

    try {
      return await fetchThirdPartyOrderHistory(customerId, scenario);
    } catch (error) {
      request.log.error(error);
      return reply.code(502).send({ message: "Unable to load third-party order history" });
    }
  });

  app.get("/api/stylists", {
    schema: {
      tags: ["stylists"],
      summary: "List simulated store-associate stylist profiles",
      querystring: {
        type: "object",
        properties: {
          specialty: { type: "string" },
          fit: { type: "string" },
          availability: { type: "string", enum: stylistAvailabilityEnum }
        }
      },
      response: {
        200: stylistListJsonSchema,
        502: errorJsonSchema
      }
    }
  }, async (request, reply) => {
    const filters = request.query as {
      specialty?: string;
      fit?: string;
      availability?: StylistAvailabilityStatus;
    };

    try {
      const data = await fetchThirdPartyStylists();
      return { stylists: filterStylists(data.stylists, filters) };
    } catch (error) {
      request.log.error(error);
      return reply.code(502).send({ message: "Unable to load third-party stylist profiles" });
    }
  });

  app.get("/api/stylists/availability", {
    schema: {
      tags: ["stylists"],
      summary: "Get the next 10 days of simulated store-associate stylist availability",
      response: {
        200: stylistAvailabilityJsonSchema,
        502: errorJsonSchema
      }
    }
  }, async (request, reply) => {
    try {
      return await fetchThirdPartyStylistAvailability();
    } catch (error) {
      request.log.error(error);
      return reply.code(502).send({ message: "Unable to load third-party stylist availability" });
    }
  });

  app.get("/api/stylists/:stylistId", {
    schema: {
      tags: ["stylists"],
      summary: "Get a simulated store-associate stylist profile",
      params: {
        type: "object",
        required: ["stylistId"],
        properties: {
          stylistId: { type: "string", minLength: 1 }
        }
      },
      response: {
        200: {
          type: "object",
          required: ["stylist"],
          properties: {
            stylist: stylistJsonSchema
          }
        },
        404: errorJsonSchema,
        502: errorJsonSchema
      }
    }
  }, async (request, reply) => {
    const { stylistId } = request.params as { stylistId: string };

    try {
      const stylist = await fetchThirdPartyStylist(stylistId);
      return { stylist };
    } catch (error) {
      request.log.error(error);

      if (error instanceof ThirdPartyHttpError && error.status === 404) {
        return reply.code(404).send({ message: "Stylist not found" });
      }

      return reply.code(502).send({ message: "Unable to load third-party stylist profile" });
    }
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
