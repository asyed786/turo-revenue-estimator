// src/app/api/create-estimate/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "../../../lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      userId,
      // vehicle basics
      make, model, year, trim,
      zipCode, city, state, latitude, longitude, mileage, segment,

      // assumptions / inputs
      protectionPlan, deliveryRadius, distanceAllowance,
      monthlyDiscount, targetMonth,
      adrEstimate, utilEstimate,
      baseAdr, trimAdj, ageAdj, seasonality, competition, netMultiplier,

      // computed outputs
      monthlyGross, monthlyNet, breakevenMonths,
      confidence, confidenceLower, confidenceUpper,
      compCount,
    } = body;

    const estimate = await prisma.estimate.create({
      data: {
        userId: userId ?? null,

        // Keep zip inside vehicleJson for now to avoid TS mismatch
        vehicleJson: {
          make: make ?? null,
          model: model ?? null,
          year: year ? Number(year) : null,
          trim: trim ?? null,
          city: city ?? null,
          state: state ?? null,
          latitude: latitude ? Number(latitude) : null,
          longitude: longitude ? Number(longitude) : null,
          mileage: mileage ? Number(mileage) : null,
          segment: segment ?? null,
          zipCode: zipCode ?? null
        },

        assumptionsJson: {
          protectionPlan: protectionPlan ?? "standard",
          deliveryRadius: deliveryRadius ? Number(deliveryRadius) : 25,
          distanceAllowance: distanceAllowance ? Number(distanceAllowance) : 200,
          monthlyDiscount: monthlyDiscount ? Number(monthlyDiscount) : 0,
          targetMonth: targetMonth ? Number(targetMonth) : null,
          adrEstimate: adrEstimate ? Number(adrEstimate) : null,
          utilEstimate: utilEstimate ? Number(utilEstimate) : null,
          baseAdr: baseAdr ? Number(baseAdr) : null,
          trimAdj: trimAdj ? Number(trimAdj) : null,
          ageAdj: ageAdj ? Number(ageAdj) : null,
          seasonality: seasonality ? Number(seasonality) : null,
          competition: competition ? Number(competition) : null,
          netMultiplier: netMultiplier ? Number(netMultiplier) : null,
        },

        estimateJson: {
          monthlyGross: monthlyGross ? Number(monthlyGross) : null,
          monthlyNet: monthlyNet ? Number(monthlyNet) : null,
          breakevenMonths: breakevenMonths ? Number(breakevenMonths) : null,
          confidence: confidence ? Number(confidence) : null,
          confidenceLower: confidenceLower ? Number(confidenceLower) : null,
          confidenceUpper: confidenceUpper ? Number(confidenceUpper) : null,
          compCount: compCount ? Number(compCount) : null,
        },
      },
      include: { user: { select: { id: true, email: true } } },
    } as any); // <-- temp cast to bypass old Prisma TS types

    return NextResponse.json(
      { success: true, data: estimate, message: "Estimate created successfully" },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error creating estimate:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to create estimate" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") ?? undefined;
    const limit = Number(searchParams.get("limit") ?? "10");
    const offset = Number(searchParams.get("offset") ?? "0");

    const where = userId ? { userId } : {};

    const [estimates, totalCount] = await Promise.all([
      prisma.estimate.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: "desc" },
        include: { user: { select: { id: true, email: true } } },
      }),
      prisma.estimate.count({ where }),
    ]);

    return NextResponse.json(
      { success: true, data: estimates, pagination: { total: totalCount, limit, offset } },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error fetching estimates:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to fetch estimates" },
      { status: 500 }
    );
  }
}
