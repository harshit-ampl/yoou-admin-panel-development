import { NextRequest, NextResponse } from "next/server";
import * as dotenv from "dotenv";

export const dynamic = 'force-dynamic';

dotenv.config();

export async function POST(req: NextRequest) {
	try {
		const { pincode } = await req?.json();
		if (pincode) {
			return NextResponse.json(
				{ message: "Delivery is available for this pincode", statusCode: 1 },
				{ status: 200 }
			);
		} else {
			return NextResponse.json(
				{ message: "No pincode provided", statusCode: 0 },
				{ status: 200 }
			);
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error?.message : "Unknown error";
		return NextResponse.json(
			{ message: errorMessage, statusCode: 0 },
			{ status: 200 }
		);
	}
}