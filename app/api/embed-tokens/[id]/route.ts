import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import type { ExtendEmbedTokenRequest, EmbedToken } from '@/types/embed-tokens';

const JWT_SECRET = process.env.EMBED_TOKEN_SECRET || 'your-embed-token-secret';

// GET /api/embed-tokens/[id] - Get token details
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: tokenId } = await params;

    // TODO: Fetch from database
    const mockToken: EmbedToken = {
      id: tokenId,
      token: 'embed_token_...',
      dashboard_id: 123,
      org_id: 1,
      created_by: 1,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date().toISOString(),
      view_count: 45,
      is_active: true,
      time_until_expiry: '28 days, 5 hours',
    };

    return NextResponse.json({ token: mockToken });
  } catch (error) {
    console.error('Error fetching embed token:', error);
    return NextResponse.json({ error: 'Failed to fetch embed token' }, { status: 500 });
  }
}

// PATCH /api/embed-tokens/[id] - Extend token expiration
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: tokenId } = await params;
    const body: ExtendEmbedTokenRequest = await request.json();

    // TODO: Add authentication and authorization checks

    // Calculate new expiration date
    const extendMs = body.extend_days * 24 * 60 * 60 * 1000;
    const newExpiresAt = new Date(Date.now() + extendMs);

    // TODO: Update in database
    // await db.embedTokens.update(tokenId, { expires_at: newExpiresAt });

    // Create new JWT with extended expiration
    const payload = {
      token_id: tokenId,
      dashboard_id: 123, // TODO: Get from database
      org_id: 1,
      created_by: 1,
      expires_at: Math.floor(newExpiresAt.getTime() / 1000),
    };

    const newToken = jwt.sign(payload, JWT_SECRET, {
      algorithm: 'HS256',
      expiresIn: `${body.extend_days}d`,
    });

    const updatedToken: EmbedToken = {
      id: tokenId,
      token: `embed_${newToken}`,
      dashboard_id: 123,
      org_id: 1,
      created_by: 1,
      expires_at: newExpiresAt.toISOString(),
      created_at: new Date().toISOString(),
      view_count: 45,
      is_active: true,
      time_until_expiry: `${body.extend_days} days`,
    };

    return NextResponse.json({
      token: updatedToken,
      message: `Token extended by ${body.extend_days} days`,
    });
  } catch (error) {
    console.error('Error extending embed token:', error);
    return NextResponse.json({ error: 'Failed to extend embed token' }, { status: 500 });
  }
}

// DELETE /api/embed-tokens/[id] - Revoke token
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tokenId } = await params;

    // TODO: Add authentication and authorization checks

    // TODO: Update in database to mark as revoked
    // await db.embedTokens.update(tokenId, {
    //   revoked_at: new Date(),
    //   is_active: false
    // });

    return NextResponse.json({
      message: 'Token revoked successfully',
      revoked_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error revoking embed token:', error);
    return NextResponse.json({ error: 'Failed to revoke embed token' }, { status: 500 });
  }
}
