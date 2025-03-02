const crypto = require("crypto")
const fs = require("fs")
const { Quizzer, Questioner } = require("terminal-quizzer")
const slimDB = require("@syrasco/slim-db/slimDB")

class install {

	// properties
	bitbucketUsername = null
	bitbucketAppPassword = null
	bitbucketAccountName = null
	encryptionKey = null
	projectDirectory = null
	questioner = null
	quizzer = null
	repositories = {}
	mode = null

	// the stages available and the methods to call them
	stages = {
		DB: () => this.stageDB(),
		projects: () => this.stageProjects(),
		bitbucket: () => this.stageBitbucket(),
		repositoryMap: () => this.stageRepositoryMap(),
		customPRQuestions: () => this.stageCustomPRQuestions(),
		customTests: () => this.stageCustomTests(),
		complete: () => this.stageComplete(),
	}

	constructor() {
		this.questioner = new Questioner()
		this.quizzer = new Quizzer(this)
	}

	createEnvFile() {
		const envFileContent = `BITBUCKET_USERNAME=${this.bitbucketUsername}\n`
			+ `BITBUCKET_APP_PASSWORD=${this.bitbucketAppPassword}\n`
			+ `BITBUCKET_ACCOUNT_NAME=${this.bitbucketAccountName}\n`
			+ `GIT_PROJECT_DIR=${this.projectDirectory}\n`
			+ `MODE=${this.mode}\n`
			+ `TASK_DB_KEY=${this.encryptionKey}`

		fs.writeFileSync(".env", envFileContent)
		console.log(
			`${this.questioner.GREEN}.env file created${this.questioner.NORMAL}`,
		)
	}

	// initialise the class
	init() {
		// set the stage
		return this.quizzer.start()
	}

	stageComplete() {
		// display a success message and end the quizzer
		console.log(
			`${this.questioner.GREEN}Installation complete${this.questioner.NORMAL}`,
		)
		this.quizzer.end()
	}

	stageDB() {
		let self = this

		// check if we have a database already
		if (fs.existsSync("./data/tasks.db")) {
			return this.quizzer.runStage("projects")
		}

		console.log(
			`${this.questioner.RED}Database:${this.questioner.NORMAL}`,
		)
		this.questioner
			.askQuestion("Do you want to encrypt the database? [y/n]")
			.then(async (answer) => {
				const mode = answer === "y"
					? "production"
					: "local"

				// Create a new random encryption key
				self.encryptionKey = crypto.randomBytes(16).toString("hex")

				// create a new db instance
				const db = new slimDB("./data", self.encryptionKey, mode)

				// store the mode on the instance so we can access it later
				self.mode = mode

				// create the data directory if it doesn't exist
				if (!fs.existsSync("./data")) {
					fs.mkdirSync("./data")
				}

				// create the tasks table
				db.createTable("tasks", {
					name: "tasks",
					columns: [
						{
							name: "id",
							type: "TEXT",
						},
						{
							name: "branch",
							type: "TEXT",
						},
						{
							name: "system",
							type: "TEXT",
						},
						{
							name: "summary",
							type: "TEXT",
						},
						{
							name: "problem",
							type: "TEXT",
						},
						{
							name: "solution",
							type: "TEXT",
						},
						{
							name: "existingPattern",
							type: "TEXT",
						},
						{
							name: "plan",
							type: "TEXT",
						},
					],
					index: [
						{
							indexName: "id",
							keys: ["id"],
						},
					],
				}).then(() => {
					// db is ready, move to the next stage
					self.quizzer.runStage("projects")
				})
			})
	}

	stageProjects() {
		let self = this

		// check if we have a .env file already
		if (fs.existsSync(".env")) {
			return this.quizzer.runStage("repositoryMap")
		}

		console.log(
			`${this.questioner.RED}Projects:${this.questioner.NORMAL}`,
		)
		this.questioner
			.askQuestion("Please enter the root path to your projects. For example, '~/projects'. Each project you use in your repositoryMap should be situated in this directory.")
			.then(async (answer) => {
				// store the projects root path in the env file. Ensure there is no trailing slash, then append '/:system:'
				self.projectDirectory = answer.replace(/\/$/, "") + "/:system:"

				// move to the next stage
				self.quizzer.runStage("bitbucket")
			})
	}

	async stageBitbucket() {
		let self = this

		console.log(
			`${this.questioner.RED}BitBucket:${this.questioner.NORMAL}`,
		)

		await this.questioner
			.askQuestion("Please enter your BitBucket username.")
			.then(async (answer) => {
				self.bitbucketUsername = answer
			})

		await this.questioner
			.askQuestion("Please enter your BitBucket app password.")
			.then(async (answer) => {
				self.bitbucketAppPassword = answer
			})

		await this.questioner
			.askQuestion("Please enter your BitBucket account name.")
			.then(async (answer) => {
				self.bitbucketAccountName = answer
			})

		// create the env file with the necessary environment variables
		this.createEnvFile()

		// move to the next stage
		self.quizzer.runStage("repositoryMap")
	}

	stageCustomPRQuestions() {
		let self = this

		// check if we have a customFlowQuestions.json already
		if (fs.existsSync("customFlowQuestions.json")) {
			return this.quizzer.runStage("customTests")
		}

		console.log(
			`${this.questioner.RED}Custom PR Questions:${this.questioner.NORMAL}`,
		)
		this.questioner
			.askMultilineQuestion("Please provide a list of custom PR questions.", "[::::]")
			.then((answers) => {
				// split the answers and trim each line
				const questions = answers.split("[::::]")
					.map((answer) => answer.trim())
					.filter((answer) => answer !== "")

				// store the answers as an array in a new customFlowQuestions.json file
				fs.writeFileSync(
					"customFlowQuestions.json",
					JSON.stringify(questions),
				)

				// move to the next stage
				self.quizzer.runStage("customTests")
			})
	}

	stageCustomTests() {
		let self = this

		// check if we have a customTests.json already
		if (fs.existsSync("customTests.json")) {
			return this.quizzer.runStage("complete")
		}

		console.log(
			`${this.questioner.RED}Custom Tests:${this.questioner.NORMAL}`,
		)
		this.questioner
			.askMultilineQuestion("Please provide a list of test commands which will be run in the relevant directory.", "[::::]")
			.then((answers) => {
				// split the answers and trim each line
				const commands = answers.split("[::::]")
					.map((answer) => answer.trim())
					.filter((answer) => answer !== "")

				// store the answers as an array in a new customTests.json file
				fs.writeFileSync(
					"customTests.json",
					JSON.stringify(commands),
				)

				// move to the final stage
				self.quizzer.runStage("complete")
			})
	}

	async stageRepositoryMap() {
		let self = this

		// check if we have a repositoryMap.json already
		if (fs.existsSync("repositoryMap.json")) {
			return this.quizzer.runStage("customPRQuestions")
		}

		console.log(
			`${this.questioner.RED}Repository Map:${this.questioner.NORMAL}`,
		)

		const repositoryAnswers = await this.questioner
			.askMultilineQuestion("Please provide a list of repositories you want to allow task master to use.", "[::::]")

		// split the answers and trim each line
		const repositories = repositoryAnswers.split("[::::]")
			.map((answer) => answer.trim())
			.filter((answer) => answer !== "")

		// for each repository, ask for the project name (this is the name of the folder)
		for (const repository of repositories) {
			const projectName = await self.questioner
				.askQuestion(`What is the folder name for the repository "${repository}"?`)

			// store this in the repositories object
			self.repositories[projectName] = repository
		}

		// store the repositories object in a new repositoryMap.json file
		fs.writeFileSync(
			"repositoryMap.json",
			JSON.stringify(self.repositories),
		)

		// move to the next stage
		self.quizzer.runStage("customPRQuestions")
	}
}

// create a new taskBuilder class
new install().init()