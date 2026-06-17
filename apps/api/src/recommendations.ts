import { config } from "./config.js";
import type {
	CurrentUser,
	OrderHistory,
	OrderHistoryScenario,
	StoreInventory,
	StoreList,
	StoreSchedulePatternList,
	StylistAvailabilitySchedule,
	StylistList,
	StylistProfile,
	UserList,
} from "./types.js";

export class ThirdPartyHttpError extends Error {
	constructor(
		message: string,
		public readonly status: number,
	) {
		super(message);
	}
}

export async function fetchThirdPartyStores(): Promise<StoreList> {
	const response = await fetch(`${config.thirdPartyBaseUrl}/stores`);

	if (!response.ok) {
		throw new ThirdPartyHttpError(
			`Third-party stores failed with ${response.status}`,
			response.status,
		);
	}

	return response.json() as Promise<StoreList>;
}

export async function fetchThirdPartyStoreInventory(
	storeId: string,
): Promise<StoreInventory> {
	const response = await fetch(
		`${config.thirdPartyBaseUrl}/stores/${encodeURIComponent(storeId)}/inventory`,
	);

	if (!response.ok) {
		throw new ThirdPartyHttpError(
			`Third-party store inventory failed with ${response.status}`,
			response.status,
		);
	}

	return response.json() as Promise<StoreInventory>;
}

export async function fetchThirdPartyStoreSchedulePatterns(): Promise<StoreSchedulePatternList> {
	const response = await fetch(
		`${config.thirdPartyBaseUrl}/stores/schedule-patterns`,
	);

	if (!response.ok) {
		throw new ThirdPartyHttpError(
			`Third-party store schedule patterns failed with ${response.status}`,
			response.status,
		);
	}

	return response.json() as Promise<StoreSchedulePatternList>;
}

export async function fetchThirdPartyCurrentUser(): Promise<CurrentUser> {
	const response = await fetch(`${config.thirdPartyBaseUrl}/me`);

	if (!response.ok) {
		throw new ThirdPartyHttpError(
			`Third-party current user failed with ${response.status}`,
			response.status,
		);
	}

	return response.json() as Promise<CurrentUser>;
}

export async function fetchThirdPartyUsers(): Promise<UserList> {
	const response = await fetch(`${config.thirdPartyBaseUrl}/users`);

	if (!response.ok) {
		throw new ThirdPartyHttpError(
			`Third-party users failed with ${response.status}`,
			response.status,
		);
	}

	return response.json() as Promise<UserList>;
}

export async function fetchThirdPartyUser(
	userId: string,
): Promise<CurrentUser> {
	const response = await fetch(
		`${config.thirdPartyBaseUrl}/users/${encodeURIComponent(userId)}`,
	);

	if (!response.ok) {
		throw new ThirdPartyHttpError(
			`Third-party user failed with ${response.status}`,
			response.status,
		);
	}

	const data = (await response.json()) as { user: CurrentUser };
	return data.user;
}

export async function fetchThirdPartyOrderHistory(
	customerId: string,
	scenario: OrderHistoryScenario = "standard",
): Promise<OrderHistory> {
	const url = new URL(
		`${config.thirdPartyBaseUrl}/customers/${encodeURIComponent(customerId)}/orders`,
	);
	url.searchParams.set("scenario", scenario);

	const response = await fetch(url);

	if (!response.ok) {
		throw new ThirdPartyHttpError(
			`Third-party order history failed with ${response.status}`,
			response.status,
		);
	}

	return response.json() as Promise<OrderHistory>;
}

export async function fetchThirdPartyStylists(): Promise<StylistList> {
	const response = await fetch(`${config.thirdPartyBaseUrl}/stylists`);

	if (!response.ok) {
		throw new ThirdPartyHttpError(
			`Third-party stylists failed with ${response.status}`,
			response.status,
		);
	}

	return response.json() as Promise<StylistList>;
}

export async function fetchThirdPartyStylistAvailability(): Promise<StylistAvailabilitySchedule> {
	const response = await fetch(
		`${config.thirdPartyBaseUrl}/stylists/availability`,
	);

	if (!response.ok) {
		throw new ThirdPartyHttpError(
			`Third-party stylist availability failed with ${response.status}`,
			response.status,
		);
	}

	return response.json() as Promise<StylistAvailabilitySchedule>;
}

export async function fetchThirdPartyStylist(
	stylistId: string,
): Promise<StylistProfile> {
	const response = await fetch(
		`${config.thirdPartyBaseUrl}/stylists/${encodeURIComponent(stylistId)}`,
	);

	if (!response.ok) {
		throw new ThirdPartyHttpError(
			`Third-party stylist failed with ${response.status}`,
			response.status,
		);
	}

	const data = (await response.json()) as { stylist: StylistProfile };
	return data.stylist;
}
