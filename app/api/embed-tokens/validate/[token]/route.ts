import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import type { ValidateTokenResponse } from '@/types/embed-tokens';

const JWT_SECRET = process.env.EMBED_TOKEN_SECRET || 'your-embed-token-secret';

interface TokenPayload {
  token_id: string;
  dashboard_id: number;
  org_id: number;
  created_by: number;
  expires_at: number; // Unix timestamp
}

// GET /api/embed-tokens/validate/[token] - Validate and get token info
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token: tokenString } = await params;

    // Remove "embed_" prefix if present
    const cleanToken = tokenString.startsWith('embed_') ? tokenString.slice(6) : tokenString;

    // Verify JWT
    const decoded = jwt.verify(cleanToken, JWT_SECRET) as TokenPayload;

    // Check if token is expired (additional check beyond JWT expiration)
    const now = Math.floor(Date.now() / 1000);
    if (decoded.expires_at < now) {
      return NextResponse.json({
        valid: false,
        error: 'Token has expired',
      } as ValidateTokenResponse);
    }

    // TODO: Check in database if token is revoked
    // const tokenRecord = await db.embedTokens.findById(decoded.token_id);
    // if (!tokenRecord || !tokenRecord.is_active) {
    //   return NextResponse.json({
    //     valid: false,
    //     error: 'Token has been revoked'
    //   } as ValidateTokenResponse);
    // }

    // TODO: Fetch actual dashboard data from database
    // const dashboard = await db.dashboards.findById(decoded.dashboard_id);

    // Mock dashboard data for now
    const mockDashboard = {
      id: decoded.dashboard_id,
      title: 'Sample Private Dashboard',
      org_name: 'Test Organization',
      data: {}, // This would contain the actual dashboard configuration
    };

    const response: ValidateTokenResponse = {
      valid: true,
      dashboard: mockDashboard,
      token_info: {
        expires_at: new Date(decoded.expires_at * 1000).toISOString(),
        view_count: 45, // TODO: Get from database
        restrictions: {
          max_views: 1000, // TODO: Get from database
        },
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Token validation error:', error);

    if (error instanceof jwt.JsonWebTokenError) {
      return NextResponse.json({
        valid: false,
        error: 'Invalid token',
      } as ValidateTokenResponse);
    }

    if (error instanceof jwt.TokenExpiredError) {
      return NextResponse.json({
        valid: false,
        error: 'Token has expired',
      } as ValidateTokenResponse);
    }

    return NextResponse.json({
      valid: false,
      error: 'Token validation failed',
    } as ValidateTokenResponse);
  }
}

// POST /api/embed-tokens/validate/[token]/track-view - Track a view
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token: tokenString } = await params;

    // Remove "embed_" prefix if present
    const cleanToken = tokenString.startsWith('embed_') ? tokenString.slice(6) : tokenString;

    // Verify JWT to get token info
    const decoded = jwt.verify(cleanToken, JWT_SECRET) as TokenPayload;

    // TODO: Track view in database
    // await db.embedTokenUsage.create({
    //   token_id: decoded.token_id,
    //   accessed_at: new Date().toISOString(),
    //   ip_address: getClientIP(request),
    //   user_agent: request.headers.get('user-agent'),
    //   referrer: request.headers.get('referer')
    // });

    // TODO: Increment view count
    // await db.embedTokens.incrementViewCount(decoded.token_id);

    console.log('View tracked for token:', decoded.token_id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to track view:', error);
    return NextResponse.json({ error: 'Failed to track view' }, { status: 500 });
  }
}
