const env = require("dotenv").config({ path: "./.env" });
const { exec } = require("child_process");
const branchQuestions = require("./branchQuestions");
const taskQuestions = require("./taskQuestions");

const slimDB = require("@syrasco/slim-db/slimDB");
const db = new slimDB("./data", process.env.TASK_DB_KEY, process.env.MODE);
const { Questioner } = require("terminal-quizzer");

/**
 * Represents a task builder and manages the process of creating a new task.
 *
 * This class handles various aspects of creating a new task, including:
 * - Creating a new branch
 * - Managing the flow of questions for task creation
 * - Storing the task details in a database
 */
class taskBuilder {
	system = null;
	branch = null;

	branchCreateReject;
	branchCreateResolve;
	branchQuestions = new branchQuestions();
	gitProjectDirectory;
	taskQuestions = null;

	/**
     * Creates a new taskBuilder instance
     */
	constructor(system) {
		this.system = system;

		// get the git project directory from the env file
		this.gitProjectDirectory = process.env.GIT_PROJECT_DIR;

		// if the project directory has a system token (:system:) then replace that
		this.gitProjectDirectory = this.gitProjectDirectory.replace(
			":system:",
			this.system
		);
	}

	/**
     * Creates a new branch, and if successful, moves to the task creation
	 * questions.
     */
	branchCommand() {
		console.log("attempting to create branch ...");
		// switch to master and pull
		exec(
			`cd ${this.gitProjectDirectory} \
			&& git stash \
			&& git checkout master \
			&& git fetch \
			&& git pull \
			&& git checkout -b ${this.branchQuestions.branchName}`,
			(err, stdout, stderr) => {
				if (err) {
					// check if the error contains 'already exists'
					if (stderr.includes("already exists")) {
						// branch exists
						console.log(
							`This branch (${this.branchQuestions.branchName}) already exists in ${this.system}\n`
						);
						console.log(
							`Trying with branch name ${this.branchQuestions.branchName}New\n`
						);
						this.branchQuestions.setBranchName(
							this.branchQuestions.branchName + "New"
						);
						this.branchCommand();
					} else if (stderr.includes("composer")) {
						// run the cs composer install command
						exec(
							`cs composer install --no-interaction --prefer-install auto`,
							() => this.branchCommand()
						);
					} else {
						this.branchCreateReject(err);
					}
				} else {
					console.log(
						`Branch ${this.branchQuestions.branchName} created`
					);
					this.branchCreateResolve(true);
				}
			}
		);
	}

	/**
     * Creates a new branch and resolves the promise with the result.
     */
	createBranch() {
		return new Promise((resolve, reject) => {
			this.branchCreateResolve = resolve;
			this.branchCreateReject = reject;
			this.branchCommand();
		});
	}

	/**
     * Starts the task builder process.
     */
	init() {
		let self = this;
		// ask for the branch details
		this.branchQuestions.init().then(() => {
			// create the branch and switch to it
			self.createBranch().then(() => {
				self.taskQuestions = new taskQuestions(
					self.system,
					self.branchQuestions.branchName
				);
				// start asking task questions
				self.taskQuestions.init().then(() => {
					// ensure we are checked out on the branch
					exec(
						`cd ${this.gitProjectDirectory} && git checkout ${this.branchQuestions.branchName}`
					);
					// ready to go
					console.log(
						"Time to get going, open up arise or the forest app and start working!"
					);
					// list the tasks
					console.table(self.taskQuestions.planTasks);
					console.log("Don't forget, work smarter not faster!");
				});
			});
		});
	}
}

/**
 * Command-line interface for creating pull requests tasks and storing them in
 * the DB, or interacting with tasks stored in the DB.
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
 * 3. run the script with the system name as an argument:
 *   `npm run task` -- add a new PR task to the first system
 *   `npm run task main` -- for a specific system
 *   `npm run task list` -- list all tasks, and perform actions
 *
 * 4. Follow the prompts to create a pull request task.
 *
 * Ensure you have the following environment variables set:
 * - BITBUCKET_PR_USERNAME
 * - BITBUCKET_PR_APP_PASSWORD
 * - BITBUCKET_ACCOUNT_NAME
 * - GIT_PROJECT_DIR -- this includes a :system: wildcard pointing to your git
 *   project directory in the format: /path/to/your/project/:system:
 * - MODE -- determines whether the DB is encrypted (production) or not (local)
 * - TASK_DB_KEY -- the encryption key for the DB
 */
if (process.argv[2] === "list") {
	let tasks = [];
	let tasksToRun = 0;
	let tasksToRunString = null;

	// see if we have any tasks available
	db.readData("tasks")
		.then((results) => {
			tasks = results;
			tasksToRun = results.length;
			tasksToRunString = results.length + " tasks";
		})
		.catch(() => (tasksToRun = 0))
		.finally(() => {
			if (tasksToRun) {
				console.log(`${tasksToRunString}`);
				let taskTable = tasks.map((task) => {
					return {
						branch: task.branch,
						system: task.system,
						summary: task.summary,
					};
				});
				// list the tasks to run
				console.table(taskTable);

				let questioner = new Questioner();
				questioner
					.askQuestion("Enter the number of the task to view:")
					.then((answer) => {
						let taskToView = tasks[parseInt(answer)];
						let instance = new taskBuilder(taskToView.system);
						questioner
							.askQuestion(
								"What would you like to do with this task?\n\n[V] View task\n[S] Switch to task\n[D] Delete task\n\n"
							)
							.then((answer) => {
								switch (answer) {
									case "V":
										console.log(`\nAction plan:`);
										console.log(
											`${questioner.CYAN}${taskToView.plan}${questioner.NORMAL}`
										);
										process.exit(1);
										break;
									case "S":
										// stash and switch to the branch
										console.log(
											`stashing changes and switching to the ${taskToView.branch} branch\n`
										);
										exec(
											`cd ${instance.gitProjectDirectory} && git stash`
										);
										exec(
											`cd ${instance.gitProjectDirectory} && git checkout ${taskToView.branch}`
										);
										console.log(
											`cd ${instance.gitProjectDirectory} && git checkout ${taskToView.branch}`
										);
										// view the task plan
										console.log(`\nAction plan:`);
										console.log(
											`${questioner.CYAN}${taskToView.plan}${questioner.NORMAL}`
										);
										process.exit(1);
										break;
									case "D":
										db.deleteData("tasks", {
											id: taskToView.id,
										}).then(() => process.exit(1));
										break;

									default:
										console.log(
											`${questioner.RED}Unknown command. Exiting${questioner.NORMAL}`
										);
										process.exit(1);
								}
							});
					});
			} else {
				console.log(`Usage: task <system>`);
				process.exit(1);
			}
		});
} else {
	// get the system from the arguments
	let system = process.argv[2];
	// create a new taskBuilder class
	let instance = new taskBuilder(system);

	// initiate the task builder logic
	instance.init();
}