import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    // Try to get IP from various headers
    const forwarded = request.headers.get("x-forwarded-for")
    const realIp = request.headers.get("x-real-ip")
    const cfConnectingIp = request.headers.get("cf-connecting-ip")
    
    let ip = forwarded?.split(",")[0] || realIp || cfConnectingIp || "unknown"
    
    // If we still don't have an IP, try to get from request
    if (ip === "unknown") {
      ip = request.ip || "unknown"
    }

    return NextResponse.json({ ip })
  } catch (error) {
    console.error("Error getting IP:", error)
    return NextResponse.json({ ip: "unknown" })
  }
}





