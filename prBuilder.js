const env = require("dotenv").config({ path: "./.env" })
const { exec } = require("child_process")
const flowQuestions = require("./flowQuestions")
const fs = require("fs")
const prQuestions = require("./prQuestions")
const setupQuestions = require("./setupQuestions")

const slimDB = require("@syrasco/slim-db/slimDB")
const db = new slimDB("./data", process.env.TASK_DB, process.env.MODE)

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
	// Colour codes for console output
	NORMAL = "\x1b[0m"
	YELLOW = "\x1b[33;01m"
	GREEN = "\x1b[32;01m"
	CYAN = "\x1b[0;36m"
	RED = "\x1b[0;31m"

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
					reject(`${this.RED}This branch does not exist in ${this.system}${this.NORMAL}\n`)
				} else {
					// branch exists
					console.log(`✔️ [${this.YELLOW}${this.branch}${this.NORMAL}] Valid branch name in ${this.system}\n`)
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
				throw new Error(`${this.RED}Failed to create pull request in ${this.system}${this.NORMAL}\n`)
			})
			.then((json) => {
				console.log(`${self.GREEN}PR successfully created${self.NORMAL}\n`)
				console.log(`${self.CYAN}PR ID: ${json.id}${self.NORMAL}`)
				console.log(`${self.CYAN}PR URL: ${json.links.html.href}${self.NORMAL}`)

				// delete the task
				if (self.taskId) {
					db.deleteData("tasks", { id: self.taskId }).then(() => {
						console.log("task removed")
						// exit the program
						process.exit(1)
					})
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
			throw new Error(`${this.RED}This repository has not been defined for ${this.system}${this.NORMAL}\n`)
		} else {
			return repositories[this.system]
		}
	}
}

/**
 * Command-line interface for creating pull requests using tasks stored in the DB, or manually creating a PR if the
 * branch name is supplied as an argument.
 *
 * Usage:
 * 1. Create a `repositoryMap.json` file in the root of your project with the
 *   following structure:
 *   {
 *       "main": "my-main-repo",
 *       "foo": "my-foo-repo",
 *       ...
 *   }
 *
 * 2. Add tasks to the DB using the `npm run task main` script.
 *
 * 3. Create a `customTests.json` file in the root of your project with the
 *   following structure:
 *   {
 *       "phpstan"
 *       "phpunit",
 *  	 ...
 *   }
 *
 * 4. run the script with the system name as an argument:
 *   `npm run pr` -- for the PR selection menu
 *   `npm run pr main my/Branch/Name` -- for a specific system and branch
 *
 * 5. Follow the prompts to create a pull request.
 *
 * Ensure you have the following environment variables set:
 * - BITBUCKET_PR_USERNAME
 * - BITBUCKET_PR_APP_PASSWORD
 * - BITBUCKET_ACCOUNT_NAME
 * - GIT_PROJECT_DIR -- this includes a :system: wildcard pointing to your git
 *   project directory in the format: /path/to/your/project/:system:
 * - MODE -- determines whether the DB is encrypted (production) or not (local)
 * - TASK_DB -- the db file name
 */
if (!process.argv[2]) {
	let tasks = []
	let tasksToRun = 0
	let tasksToRunString = null

	// see if we have any tasks available
	db.readData("tasks")
		.then((results) => {
			tasks = results
			tasksToRun = results.length
			tasksToRunString = results.length + " tasks"
		})
		.catch(() => (tasksToRun = 0))
		.finally(() => {
			if (tasksToRun) {
				console.log(`${tasksToRunString}`)
				let taskTable = tasks.map((task) => {
					return {
						branch: task.branch, system: task.system, summary: task.summary,
					}
				})
				// list the tasks to run
				console.table(taskTable)
				// ask for the number of the task to run
				const readline = require("readline")
				let rl = readline.createInterface({
					input: process.stdin, output: process.stdout,
				})
				rl.question("Enter the number of the task to run: ", (answer) => {
					let taskToRun = tasks[parseInt(answer)]
					let pr = new pullRequest(taskToRun.system, taskToRun.branch)
					// set the task id so we can reference it when within the class
					pr.taskId = `${taskToRun.id}`
					// patch in the task plan to the solution if it's not empty
					let solution = taskToRun.plan?.length > 0 ? taskToRun.solution + "\n**Actions followed:**\n\n" + taskToRun.plan : taskToRun.solution
					// instantiate the prQuestions class
					pr.prQuestions = new prQuestions({
						purposeSummary: taskToRun.summary, purposeProblem: taskToRun.problem, purposeSolution: solution,
					})
					rl.close()
					// init the pullRequest class
					pr.init()
				})
			} else {
				console.log(`Usage: task <system>`)
				process.exit(1)
			}
		})
} else {
	let system = process.argv[2]
	let branch = process.argv[3]
	// create a new pullRequest class
	let pr = new pullRequest(system, branch)

	// initiate the pull request logic
	pr.init()
}