import { resolveConfig } from 'vite';
import { expect } from 'chai';
import { compile } from '../../../dist/core/compile/index.js';
import { AggregateError } from '../../../dist/core/errors/index.js';
import { pathToFileURL } from 'node:url';

describe('astro/src/core/compile', () => {
	describe('Invalid CSS', () => {
		it('throws an aggregate error with the errors', async () => {
			let error;
			try {
				await compile({
					astroConfig: {
						root: pathToFileURL('/'),
						experimental: {},
					},
					viteConfig: await resolveConfig({ configFile: false }, 'serve'),
					filename: '/src/pages/index.astro',
					source: `
	---
	---
	<style lang="scss">
		article:global(:is(h1, h2, h3, h4, h5, h6):hover {
			color: purple;
		}
	</style>
	<style lang="scss">
		article:is(h1, h2, h3, h4, h5, h6:hover {
			color: purple;
		}
	</style>
	`,
				});
			} catch (err) {
				error = err;
			}

			expect(error).to.be.an.instanceOf(AggregateError);
			expect(error.errors[0].message).to.contain('expected ")"');
		});
	});
});
