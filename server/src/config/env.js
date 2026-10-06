export const PORT = Number(process.env.PORT) || 3000;
export const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/campus_claim';
export const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
