require("dotenv").config({ path: "./.env" });
const { exec } = require("child_process");
const branchQuestions = require("./branchQuestions");
const taskQuestions = require("./taskQuestions");

const { initDB } = require("./Helper")
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
			self.createBranch()
				.then(() => {
					self.taskQuestions = new taskQuestions(
						self.system,
						self.branchQuestions.branchName
					);
					// start asking task questions
					self.taskQuestions.init()
						.then(() => {
							// ensure we are checked out on the branch
							exec(
								`cd ${this.gitProjectDirectory} && git checkout ${this.branchQuestions.branchName}`
							);
							// ready to go
							console.log(
								"Time to get going!"
							);
							// list the tasks
							console.table(self.taskQuestions.planTasks);
							console.log("Don't forget, work smarter not faster!");
						});
				})
		});
	}
}

function askQuestions(taskToView) {
	let questioner = new Questioner()
	let instance = new taskBuilder(taskToView.system)
	questioner
		.showMenu(
			`What would you like to do with this task?`,
			{
				'V': 'View task',
				'S': 'Switch to task',
				'D': 'Delete task'
			},
			taskToView.branch
		)
		.then((answer) => {
			switch (answer) {
				case "V":
					console.log(`\nAction plan:`)
					console.log(
						`${questioner.CYAN}${taskToView.plan}${questioner.NORMAL}`,
					)
					process.exit(1)
					break
				case "S":
					// stash and switch to the branch
					console.log(
						`stashing changes and switching to the ${taskToView.branch} branch\n`,
					)
					exec(
						`cd ${instance.gitProjectDirectory} && git stash`,
					)
					exec(
						`cd ${instance.gitProjectDirectory} && git checkout ${taskToView.branch}`,
					)
					console.log(
						`cd ${instance.gitProjectDirectory} && git checkout ${taskToView.branch}`,
					)
					// view the task plan
					console.log(`\nAction plan:`)
					console.log(
						`${questioner.CYAN}${taskToView.plan}${questioner.NORMAL}`,
					)
					process.exit(1)
					break
				case "D":
					questioner.showYesNoMenu('Are you sure you want to delete this task?')
						.then(async (answer) => {
							if (answer === 'y') {
								const db = await initDB();
								await db.deleteData("tasks", {
									id: taskToView.id,
								})
								await db.close()
								process.exit(1)
							} else {
								`${questioner.RED}Exiting${questioner.NORMAL}`,
								process.exit(1)
							}
						})
					break

				default:
					console.log(
						`${questioner.RED}Unknown command. Exiting${questioner.NORMAL}`,
					)
					process.exit(1)
			}
		})
}

async function listTasks() {
	const db = await initDB();
	const tasks = await db.readData("tasks");
	await db.close()
	const tasksToRun = tasks.length;
	const tasksToRunString = tasks.length + " tasks";

	if (tasksToRun) {
		console.log(`${tasksToRunString}`);
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
				askQuestions(tasks[selectedTask])
			})
	} else {
		console.log(`Usage: task <system>`);
		process.exit(1);
	}
}

if (process.argv[2] === "list") {
	listTasks()
} else {
	// get the system from the arguments
	let system = process.argv[2];
	// create a new taskBuilder class
	let instance = new taskBuilder(system);

	// initiate the task builder logic
	instance.init();
}