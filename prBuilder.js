require("dotenv").config({ path: "./.env" })
const { exec } = require("child_process")
const flowQuestions = require("./flowQuestions")
const fs = require("fs")
const prQuestions = require("./prQuestions")
const setupQuestions = require("./setupQuestions")

const { initDB } = require("./Helper")
const Colours = require("./UI/colours")
const { Questioner } = require("terminal-quizzer")

/**
 * Represents a pull request and manages the process of creating one.
 *
 * This class handles various aspects of creating a pull request, including:
 * - Checking if the branch exists
 * - Setting up the pull request details
 * - Creating the pull request in Bitbucket
 * - Managing the flow of questions for PR creation
 */
class pullRequest {

	// core variables which will be populated on instantiation
	system = null
	branch = null
	gitProjectDirectory = null

	// optionally injected into this class when creating from a task
	taskId = null

	// Question objects for different stages of PR creation
	setupQuestions = new setupQuestions()
	flowQuestions = new flowQuestions()
	prQuestions = new prQuestions()

	/**
	 * Creates a new pullRequest instance
	 */
	constructor(system, branch) {
		this.system = system

		// get the git project directory from the env file
		this.gitProjectDirectory = process.env.GIT_PROJECT_DIR

		// if the project directory has a system token (:system:) then replace that
		this.gitProjectDirectory = this.gitProjectDirectory.replace(":system:", this.system)

		// get the branch name
		this.branch = branch
	}

	/**
	 * Checks if the branch exists, and prompts the user for necessary details.
	 */
	checkBranchExists() {
		let bashCommand = `cd ${this.gitProjectDirectory} && git show-ref --quiet refs/heads/${this.branch}`

		return new Promise((resolve, reject) => {
			exec(bashCommand, (error) => {
				if (error) {
					reject(`${Colours.RED}This branch does not exist in ${this.system}${Colours.NORMAL}\n`)
				} else {
					// branch exists
					console.log(`✔️ [${Colours.YELLOW}${this.branch}${Colours.NORMAL}] Valid branch name in ${this.system}\n`)
					resolve(true)
				}
			})
		})
	}

	/**
	 * Sets up the pull request details based on user input.
	 */
	async createPullRequest() {
		let self = this
		let authentication = process.env.BITBUCKET_PR_USERNAME + ":" + process.env.BITBUCKET_PR_APP_PASSWORD
		let encodedAuthentication = Buffer.from(authentication).toString("base64")
		let repository = await this.repository()
		let bitbucketAccount = process.env.BITBUCKET_ACCOUNT_NAME
		let body = this.json

		this.fetch(`https://api.bitbucket.org/2.0/repositories/${bitbucketAccount}/${repository}/pullrequests`, {
			body: JSON.stringify(body), method: "POST", headers: {
				Authorization: "Basic " + encodedAuthentication,
				Accept: "application/json",
				"Content-Type": "application/json",
			},
		})
			.then((response) => {
				if (response.ok) return response.json()
				console.log(`Response: ${response.status} ${response.statusText}`)
				throw new Error(`${Colours.RED}Failed to create pull request in ${this.system}${Colours.NORMAL}\n`)
			})
			.then(async (json) => {
				console.log(`${Colours.GREEN}PR successfully created${Colours.NORMAL}\n`)
				console.log(`${Colours.CYAN}PR ID: ${json.id}${Colours.NORMAL}`)
				console.log(`${Colours.CYAN}PR URL: ${json.links.html.href}${Colours.NORMAL}`)

				// delete the task
				if (self.taskId) {
					const db = await initDB()
					await db.deleteData("tasks", { id: self.taskId })
					console.log("task removed")
					// close the database
					await db.close()
					process.exit(1)
				} else {
					// exit the program
					process.exit(1)
				}
			})
			.catch((err) => console.error(err))
	}

	/**
	 * implements a custom fetch function using node-fetch. This way we can use
	 * 'fetch' within our Node.js environment.
	 */
	fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args))

	/**
	 * Initializes the pull request creation process.
	 *
	 * This method orchestrates the entire flow of creating a pull request,
	 * including setup, branch verification, and question prompts.
	 */
	init() {
		this.setupQuestions.init().then(() => {
			this.destination = this.setupQuestions.destinationBranch

			this.checkBranchExists()
				.then(async () => {
					let bitbucketAccount = process.env.BITBUCKET_ACCOUNT_NAME
					let repository = await this.repository()

					// stash and switch to the branch
					console.log(`stashing changes and switching to the ${this.branch} branch\n`)
					exec(`cd ${this.gitProjectDirectory} && git stash`)
					exec(`cd ${this.gitProjectDirectory} && git checkout ${this.branch}`)

					// open the diff in the browser for review
					exec(`open https://bitbucket.org/${bitbucketAccount}/${repository}/branch/${this.branch}?dest=${this.destination}`)

					// start the flow questions
					this.flowQuestions.init().then(() => {
						// flow questions are complete, now start the pull request questions
						this.prQuestions.init().then(() => {
							// pull request questions are complete, now create the pull request
							this.createPullRequest()
						})
					})
				})
				.catch((err) => {
					console.error(err)
					// exit the program
					process.exit(1)
				})
		})
	}

	/**
	 * Returns the JSON object representing the pull request details.
	 */
	get json() {
		return {
			title: this.branch, description: this.prQuestions.description, source: {
				branch: {
					name: this.branch,
				},
			}, destination: {
				branch: {
					name: this.destination ?? "master",
				},
			}, close_source_branch: true,
		}
	}

	/**
	 * Loads the repository name based on the system name. This method reads the
	 * `repositoryMap.json` file to find the repository name for the given system.
	 */
	async repository() {
		// load the repository map json
		const filePath = `./repositoryMap.json`
		const data = await fs.promises.readFile(filePath, "utf8")
		const repositories = JSON.parse(data)

		// get the repository keyed by the system
		this.system = this.system.toLowerCase()
		// either return the repository name or throw an error
		if (!(this.system in repositories)) {
			throw new Error(`${Colours.RED}This repository has not been defined for ${this.system}${Colours.NORMAL}\n`)
		} else {
			return repositories[this.system]
		}
	}
}

function runTask(taskToRun) {
	let pr = new pullRequest(taskToRun.system, taskToRun.branch)
	// set the task id so we can reference it when within the class
	pr.taskId = `${taskToRun.id}`
	// patch in the task plan to the solution if it's not empty
	let solution = taskToRun.plan?.length > 0 ? taskToRun.solution + "\n**Actions followed:**\n\n" + taskToRun.plan : taskToRun.solution
	// instantiate the prQuestions class
	pr.prQuestions = new prQuestions({
		purposeSummary: taskToRun.summary, purposeProblem: taskToRun.problem, purposeSolution: solution,
	})
	// init the pullRequest class
	pr.init()
}

async function selectTasks() {
	const db = await initDB();
	const tasks = await db.readData("tasks");
	// close the database
	db.close()
	const tasksToRun = tasks.length;
	const tasksToRunString = tasks.length + " tasks";

	if (tasksToRun) {
		console.log(`${tasksToRunString}`)
		let rows = tasks.map((task, i) => ({
			id: i,
			branch: task.branch,
			system: task.system,
			summary: task.summary,
		}))
		let columns = [
			{name: "branch", label: "Branch", width: 70},
			{name: "system", label: "System", width: 15},
			{name: "summary", label: "Summary", width: 110},
		]

		let questioner = new Questioner
		questioner.showTableMenu("Select a task to run", columns, rows)
			.then((selectedTask) => {
				runTask(tasks[selectedTask])
			})
	} else {
		console.log(`Usage: task <system>`)
		process.exit(1)
	}
}

if (!process.argv[2]) {
	selectTasks()
} else {
	let system = process.argv[2]
	let branch = process.argv[3]
	// create a new pullRequest class
	let pr = new pullRequest(system, branch)

	// initiate the pull request logic
	pr.init()
}