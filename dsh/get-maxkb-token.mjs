#!/usr/bin/env node
import { readFile } from 'node:fs/promises'

const [accountPath, baseUrl = process.env.MAXKB_BASE_URL || 'http://127.0.0.1:8080'] = process.argv.slice(2)
if (!accountPath) throw new Error('Usage: get-maxkb-token.mjs ACCOUNT_JSON [MAXKB_URL]')
const account = JSON.parse((await readFile(accountPath, 'utf8')).replace(/^\uFEFF/, ''))
const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/admin/api/user/login`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ username: account.username, password: account.password }),
})
const body = await response.json()
const token = body?.data?.token
if (!response.ok || !token) throw new Error(body?.message || 'MaxKB login did not return a token')
process.stdout.write(String(token))
