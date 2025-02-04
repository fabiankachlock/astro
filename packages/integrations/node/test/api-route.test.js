import nodejs from '../dist/index.js';
import { loadFixture, createRequestAndResponse } from './test-utils.js';
import crypto from 'node:crypto';
import { describe, it, before } from 'node:test';
import * as assert from 'node:assert/strict';

describe('API routes', () => {
	/** @type {import('./test-utils').Fixture} */
	let fixture;

	before(async () => {
		fixture = await loadFixture({
			root: './fixtures/api-route/',
			output: 'server',
			adapter: nodejs({ mode: 'middleware' }),
		});
		await fixture.build();
	});

	it('Can get the request body', async () => {
		const { handler } = await import('./fixtures/api-route/dist/server/entry.mjs');
		let { req, res, done } = createRequestAndResponse({
			method: 'POST',
			url: '/recipes',
		});

		req.once('async_iterator', () => {
			req.send(JSON.stringify({ id: 2 }));
		});

		handler(req, res);

		let [buffer] = await done;

		let json = JSON.parse(buffer.toString('utf-8'));

		assert.equal(json.length, 1);

		assert.equal(json[0].name, 'Broccoli Soup');
	});

	it('Can get binary data', async () => {
		const { handler } = await import('./fixtures/api-route/dist/server/entry.mjs');

		let { req, res, done } = createRequestAndResponse({
			method: 'POST',
			url: '/binary',
		});

		req.once('async_iterator', () => {
			req.send(Buffer.from(new Uint8Array([1, 2, 3, 4, 5])));
		});

		handler(req, res);

		let [out] = await done;
		let arr = Array.from(new Uint8Array(out.buffer));
		assert.deepEqual(arr, [5, 4, 3, 2, 1]);
	});

	it('Can post large binary data', async () => {
		const { handler } = await import('./fixtures/api-route/dist/server/entry.mjs');

		let { req, res, done } = createRequestAndResponse({
			method: 'POST',
			url: '/hash',
		});

		handler(req, res);

		let expectedDigest = null;
		req.once('async_iterator', () => {
			// Send 256MB of garbage data in 256KB chunks. This should be fast (< 1sec).
			let remainingBytes = 256 * 1024 * 1024;
			const chunkSize = 256 * 1024;

			const hash = crypto.createHash('sha256');
			while (remainingBytes > 0) {
				const size = Math.min(remainingBytes, chunkSize);
				const chunk = Buffer.alloc(size, Math.floor(Math.random() * 256));
				hash.update(chunk);
				req.emit('data', chunk);
				remainingBytes -= size;
			}

			req.emit('end');
			expectedDigest = hash.digest();
		});

		let [out] = await done;
		assert.deepEqual(new Uint8Array(out.buffer), new Uint8Array(expectedDigest));
	});

	it('Can bail on streaming', async () => {
		const { handler } = await import('./fixtures/api-route/dist/server/entry.mjs');
		let { req, res, done } = createRequestAndResponse({
			url: '/streaming',
		});

		let locals = { cancelledByTheServer: false };

		handler(req, res, () => {}, locals);
		req.send();

		await new Promise((resolve) => setTimeout(resolve, 500));
		res.emit('close');

		await done;

		assert.deepEqual(locals, { cancelledByTheServer: true });
	});
});
