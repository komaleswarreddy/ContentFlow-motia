import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Clear all Clerk-related cookies
  const response = NextResponse.json({ 
    success: true, 
    message: 'Session cleared' 
  });
  
  // Delete all possible Clerk session cookies
  const cookiesToDelete = [
    '__session',
    '__client_uat',
    '__clerk_db_jwt',
    '__clerk_db_jwt_4',
    '__clerk_db_jwt_1',
    '__clerk_db_jwt_2',
    '__clerk_db_jwt_3',
  ];

  cookiesToDelete.forEach(cookieName => {
    response.cookies.delete(cookieName);
    // Also try with different path and domain options
    response.cookies.set(cookieName, '', {
      expires: new Date(0),
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });
  });

  return response;
}

