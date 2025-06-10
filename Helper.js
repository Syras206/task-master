require("dotenv").config({ path: "./.env" });
const { SlimCryptDB } = require("slimcryptdb")

async function initDB() {
	const db = new SlimCryptDB("./data", Buffer.from(process.env.TASK_DB_KEY, 'hex'), {
		encrypt: process.env.ENCRYPT === "true",
	})
	await db.ready()
	return db
}

module.exports = { initDB }