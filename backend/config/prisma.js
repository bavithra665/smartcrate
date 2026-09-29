const { randomBytes } = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter }).$extends({
	query: {
		$allModels: {
			async create({ args, query }) {
				args.data.id ||= randomBytes(12).toString('hex');
				return query(args);
			},
		},
	},
});

module.exports = prisma;