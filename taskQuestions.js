const { Quizzer, Questioner } = require("terminal-quizzer")
const fs = require("fs")

const { SlimCryptDB } = require("slimcryptdb")
const db = new SlimCryptDB("./data", Buffer.from(process.env.TASK_DB_KEY, 'hex'), {
	encrypt: process.env.ENCRYPT === "true",
})

class taskQuestions {
	questioner = new Questioner()
	quizzer = new Quizzer(this)

	existingPatternDescription = null
	plan = null
	planTasks = null
	taskProblem = null
	taskSolution = null
	taskSummary = null

	stages = {
		taskSummary: () => this.stageTaskSummary(),
		taskProblem: () => this.stageTaskProblem(),
		taskSolution: () => this.stageTaskSolution(),
		existingPatterns: () => this.stageExistingPatterns(),
		makePlan: () => this.stageMakePlan(),
		complete: () => this.stageComplete(),
	}

	constructor(system, branch) {
		this.system = system
		this.branch = branch
	}

	get description() {
		let description = "### Task Notes\n> \n" + "> " + this.taskSummary + "\n> \n" + "> **Problem:**\n" + this.taskProblem + "> \n" + "> **Solution:**\n" + this.taskSolution + "\n\n"

		if (this.existingPatternDescription) {
			description += "### There is an existing pattern to solve this task\n\n" + this.existingPatternDescription + "\n\n"
		}

		description += "### Plan of action\n" + this.plan + "\n"

		return description
	}

	get json() {
		return {
			branch: this.branch,
			system: this.system,
			summary: this.taskSummary,
			problem: this.taskProblem,
			solution: this.taskSolution,
			existingPattern: this.existingPatternDescription,
			plan: this.plan,
		}
	}

	// initialise the class
	init() {
		// set the stage
		return this.quizzer.start()
	}

	stageTaskSummary() {
		let self = this

		console.log(`${this.questioner.NORMAL}Task:`)
		console.log(`${this.questioner.CYAN}In this section we will concisely state what this task sets out to achieve, ask yourself why we need this change.${this.questioner.NORMAL}\n`)
		console.log(`${this.questioner.CYAN}The task is broken down into a summary, a problem and a solution.${this.questioner.NORMAL}\n`)

		console.log(`${this.questioner.CYAN}Summary:${this.questioner.NORMAL}`)
		this.questioner
			.askQuestion("Write a summary of the task. It is a short description of what the task does.")
			.then((answer) => {
				self.taskSummary = answer
				self.quizzer.runStage("taskProblem")
			})
	}

	stageTaskProblem() {
		let self = this

		console.log(`${this.questioner.NORMAL}Problem:`)

		this.questioner
			.askMultilineQuestion("Describe the problem this task sets out to solve. Explain why this task is needed.", "> \n> ~ ")
			.then((answer) => {
				self.taskProblem = answer
				self.quizzer.runStage("taskSolution")
			})
	}

	stageTaskSolution() {
		let self = this

		console.log(`${this.questioner.NORMAL}Solution:`)

		this.questioner
			.askMultilineQuestion("Describe the solution to the problem. This part justifies the approach you took.", "> \n> ~ ")
			.then((answer) => {
				self.taskSolution = answer
				self.quizzer.runStage("existingPatterns")
			})
	}

	stageExistingPatterns() {
		let self = this

		this.questioner
			.showYesNoMenu(`Are there any existing patterns for what you are trying to achieve in this task? i.e. Has this been done before?`)
			.then((answer) => {
				if (answer === "y") {
					this.questioner
						.askMultilineQuestion(`Where has this been done before? What steps were taken to do it there?`)
						.then((answer) => {
							self.existingPatternDescription = answer
							self.quizzer.runStage("makePlan")
						})
				} else {
					self.existingPatternDescription = null
					self.quizzer.runStage("makePlan")
				}
			})
	}

	stageMakePlan() {
		let self = this

		this.questioner
			.askMultilineQuestion("Write out a step-by-step plan for exactly what needs doing for this task.", "\t- ")
			.then((answer) => {
				self.plan = answer
				// split the plan string into an array of plan tasks
				self.planTasks = self.plan.split("\n").map(function(item) {
					// remove the '\t-' prefix and any leading/trailing whitespace
					return item.replace(/\t-/, "").trim()
				})
				// loop through the plan tasks and remove the '-[] ' prefix
				self.planTasks.forEach((planTask, index) => {
					if (planTask.startsWith("-[] ")) self.planTasks.splice(index, 1)
				})
				self.quizzer.runStage("complete")
			})
	}

	stageComplete() {
		// store the description in tmp-task-description.log so we have it
		let tmpFile = "tmp-task-description.log"
		let description = this.description
		let descriptionFile = fs.openSync(tmpFile, "w")
		fs.writeSync(descriptionFile, description)
		fs.closeSync(descriptionFile)

		// add the task to the database
		db.addData("tasks", this.json).then(() => this.quizzer.end())
	}
}

module.exports = taskQuestions