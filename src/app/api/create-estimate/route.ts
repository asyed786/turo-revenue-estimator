// src/app/api/create-estimate/route.ts

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      userId,
      make,
      model,
      year,
      trim,
      zipCode,
      city,
      state,
      latitude,
      longitude,
      mileage,
      purchasePrice,
      monthlyFixedCosts,
      protectionPlan,
      deliveryRadius,
      distanceAllowance,
      monthlyDiscount,
      targetMonth,
      adrEstimate,
      utilEstimate,
      monthlyGross,
      monthlyNet,
      breakevenMonths,
      confidence,
      confidenceLower,
      confidenceUpper,
      segment,
      compCount,
      baseAdr,
      trimAdj,
      ageAdj,
      seasonality,
      competition,
      netMultiplier
    } = body;

    const estimate = await prisma.estimate.create({
      data: {
        userId,
        make,
        model,
        year: parseInt(year),
        trim: trim || null,
        zipCode,
        city,
        state,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        mileage: mileage ? parseInt(mileage) : null,
        purchasePrice: purchasePrice ? parseFloat(purchasePrice) : null,
        monthlyFixedCosts: monthlyFixedCosts ? parseFloat(monthlyFixedCosts) : null,
        protectionPlan: protectionPlan || 'standard',
        deliveryRadius: deliveryRadius ? parseInt(deliveryRadius) : 25,
        distanceAllowance: distanceAllowance ? parseInt(distanceAllowance) : 200,
        monthlyDiscount: monthlyDiscount ? parseFloat(monthlyDiscount) : 0,
        targetMonth: parseInt(targetMonth),
        adrEstimate: parseFloat(adrEstimate),
        utilEstimate: parseFloat(utilEstimate),
        monthlyGross: parseFloat(monthlyGross),
        monthlyNet: parseFloat(monthlyNet),
        breakevenMonths: breakevenMonths ? parseFloat(breakevenMonths) : null,
        confidence: parseFloat(confidence),
        confidenceLower: parseFloat(confidenceLower),
        confidenceUpper: parseFloat(confidenceUpper),
        segment,
        compCount: parseInt(compCount),
        baseAdr: parseFloat(baseAdr),
        trimAdj: parseFloat(trimAdj),
        ageAdj: parseFloat(ageAdj),
        seasonality: parseFloat(seasonality),
        competition: parseFloat(competition),
        netMultiplier: parseFloat(netMultiplier)
      },
      include: {
        user: {
          select: {
            id: true,
            email: true
          }
        }
      }
    });

    return NextResponse.json(
      { success: true, data: estimate, message: 'Estimate created successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error creating estimate:', error);

    let errorMessage = 'An error occurred while creating the estimate';
    let statusCode = 500;

    if (error instanceof Error) {
      if (error.message.includes('P2002')) {
        errorMessage = 'An estimate with these details already exists';
        statusCode = 409;
      } else if (error.message.includes('P2003')) {
        errorMessage = 'Invalid user reference';
        statusCode = 400;
      } else if (error.message.includes('P2025')) {
        errorMessage = 'Related record not found';
        statusCode = 404;
      } else {
        errorMessage = error.message;
      }
    }

    return NextResponse.json(
      { success: false, error: errorMessage, message: 'Failed to create estimate' },
      { status: statusCode }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const limit = searchParams.get('limit') || '10';
    const offset = searchParams.get('offset') || '0';

    const where = userId ? { userId } : {};

    const estimates = await prisma.estimate.findMany({
      where,
      take: parseInt(limit),
      skip: parseInt(offset),
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { id: true, email: true }
        }
      }
    });

    const totalCount = await prisma.estimate.count({ where });

    return NextResponse.json(
      { success: true, data: estimates, pagination: { total: totalCount, limit: parseInt(limit), offset: parseInt(offset) } },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching estimates:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch estimates', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
