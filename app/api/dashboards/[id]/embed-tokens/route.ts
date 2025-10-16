import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import jwt from 'jsonwebtoken';
import type { CreateEmbedTokenRequest, EmbedToken } from '@/types/embed-tokens';

// Mock secret - in production, use environment variable
const JWT_SECRET = process.env.EMBED_TOKEN_SECRET || 'your-embed-token-secret';

interface TokenPayload {
  token_id: string;
  dashboard_id: number;
  org_id: number;
  created_by: number;
  expires_at: number; // Unix timestamp
}

// GET /api/dashboards/[id]/embed-tokens - List all tokens for a dashboard
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: dashboardId } = await params;

    // TODO: Add authentication check here
    // const user = await getCurrentUser(request);
    // if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // TODO: Replace with actual database query
    // For now, return mock data
    const mockTokens: EmbedToken[] = [
      {
        id: 'token-1',
        token: 'embed_token_...',
        dashboard_id: parseInt(dashboardId),
        org_id: 1,
        created_by: 1,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
        created_at: new Date().toISOString(),
        view_count: 45,
        is_active: true,
        time_until_expiry: '28 days, 5 hours',
        restrictions: {
          domains: ['partner-site.com'],
          max_views: 1000,
        },
      },
    ];

    return NextResponse.json({ tokens: mockTokens });
  } catch (error) {
    console.error('Error fetching embed tokens:', error);
    return NextResponse.json({ error: 'Failed to fetch embed tokens' }, { status: 500 });
  }
}

// POST /api/dashboards/[id]/embed-tokens - Create new embed token
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: dashboardId } = await params;
    const body: CreateEmbedTokenRequest = await request.json();

    // TODO: Add authentication and authorization checks
    // const user = await getCurrentUser(request);
    // const hasAccess = await checkDashboardAccess(user.id, dashboardId);

    const tokenId = nanoid(16);
    const expiresInMs = (body.expires_in_days || 30) * 24 * 60 * 60 * 1000;
    const expiresAt = new Date(Date.now() + expiresInMs);

    // Create JWT payload
    const payload: TokenPayload = {
      token_id: tokenId,
      dashboard_id: parseInt(dashboardId),
      org_id: 1, // TODO: Get from authenticated user
      created_by: 1, // TODO: Get from authenticated user
      expires_at: Math.floor(expiresAt.getTime() / 1000), // Unix timestamp
    };

    // Sign the JWT
    const token = jwt.sign(payload, JWT_SECRET, {
      algorithm: 'HS256',
      expiresIn: `${body.expires_in_days || 30}d`,
    });

    // TODO: Save to database
    const embedToken: EmbedToken = {
      id: tokenId,
      token: `embed_${token}`,
      dashboard_id: parseInt(dashboardId),
      org_id: 1,
      created_by: 1,
      expires_at: expiresAt.toISOString(),
      created_at: new Date().toISOString(),
      view_count: 0,
      is_active: true,
      restrictions: body.restrictions,
    };

    // TODO: Insert into database
    // await db.embedTokens.create(embedToken);

    return NextResponse.json({
      token: embedToken,
      embed_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'}/embed/private/dashboard/${embedToken.token}`,
    });
  } catch (error) {
    console.error('Error creating embed token:', error);
    return NextResponse.json({ error: 'Failed to create embed token' }, { status: 500 });
  }
}
