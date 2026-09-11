import request from 'supertest';
import * as xlsx from 'xlsx';
import { createApp } from '../server';
import { prisma } from '../db';

async function debug() {
  const app = createApp();
  const adminLogin = await request(app).post('/api/auth/login').send({ email: 'admin@college.edu', password: 'admin123' });
  const adminToken = adminLogin.body.token;

  const testWorkbook = xlsx.utils.book_new();
  const testRows = [
    ['Register Number', 'Student Name', 'Department', 'Year', 'Section', 'Parent Name', 'Parent Mobile'],
    ['2025CSE060', 'Gautam Singhania', 'CSE', '3', 'A', 'Vijay Singhania', '+919876543299']
  ];
  const testSheet = xlsx.utils.aoa_to_sheet(testRows);
  xlsx.utils.book_append_sheet(testWorkbook, testSheet, 'TestSheet');
  const excelBuffer = xlsx.write(testWorkbook, { type: 'buffer', bookType: 'xlsx' });

  const res = await request(app)
    .post('/api/admin/students/import/preview')
    .set('Authorization', 'Bearer ' + adminToken)
    .attach('file', excelBuffer, 'test.xlsx');

  console.log('Status:', res.status);
  console.log('Summary:', JSON.stringify(res.body.summary, null, 2));
  console.log('Row 0 errors:', res.body.rows ? res.body.rows[0]?.errors : res.body);
  console.log('Row 0 data:', res.body.rows ? res.body.rows[0]?.data : null);

  const tplRes = await request(app)
    .get('/api/admin/students/import/template')
    .set('Authorization', 'Bearer ' + adminToken)
    .buffer(true);
  console.log('Tpl Status:', tplRes.status, 'Is Buffer:', Buffer.isBuffer(tplRes.body));
  if (Buffer.isBuffer(tplRes.body)) {
    const wb = xlsx.read(tplRes.body, { type: 'buffer' });
    console.log('Tpl sheet names:', wb.SheetNames);
  }

  await prisma.$disconnect();
}
debug().catch(console.error);
