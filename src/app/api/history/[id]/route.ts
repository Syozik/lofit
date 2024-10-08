// app/api/transactions/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/app/api/db_config';


export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id;

  if (!id) {
    return NextResponse.json({ error: 'ID is required' }, { status: 400 });
  }

  try {
    const accountInfo = await pool.query(
      'SELECT id, type, amount, date, section, category, description FROM transactions WHERE id = $1 ORDER BY date DESC;',
      [id]
    );

    if (accountInfo.rows.length === 0) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    return NextResponse.json(accountInfo.rows, { status: 200 });
  } catch (err) {
    console.error('Error executing query', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export async function PUT() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export async function DELETE() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}