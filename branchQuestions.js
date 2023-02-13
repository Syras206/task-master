const { Quizzer, Questioner } = require("terminal-quizzer")

class branchQuestions {
	branch = null
	description = null
	model = null
	module = null
	stages = {
		module: () => this.stageModule(),
		model: () => this.stageModel(),
		description: () => this.stageDescription(),
		complete: () => this.stageComplete(),
	}

	constructor() {
		this.quizzer = new Quizzer(this)
		this.questioner = new Questioner()
	}

	get branchName() {
		if (this.branch) return this.branch

		// turn a mixed case string into a camel cased string
		let branchDescriptor = this.toCamelCase(this.description)

		// turn a mixed case string into a camel cased string
		let branchModel = this.toCamelCase(this.model)

		return (this.toCamelCase(this.module) + `/${branchModel}` + `/${branchDescriptor}`)
	}

	// initialise the class
	init() {
		// start the quiz
		return this.quizzer.start()
	}

	setBranchName(branchName) {
		this.branch = branchName
	}

	stageModule() {
		this.questioner
			.askQuestion(`What is the module name this task is associated with? If none, then use three words max to identify the project this task belongs to.`)
			.then((answer) => {
				this.module = answer
				this.quizzer.runStage("model")
			})
	}

	stageModel() {
		this.questioner
			.askQuestion(`What is the model name this task is associated with? If none, then use three words max to identify the where the functionality impacts. i.e. ui.`)
			.then((answer) => {
				this.model = answer
				this.quizzer.runStage("description")
			})
	}

	stageDescription() {
		this.questioner
			.askQuestion(`use three words max to identify this task. i.e. new widget.`)
			.then((answer) => {
				this.description = answer
				this.quizzer.runStage("complete")
			})
	}

	stageComplete() {
		this.quizzer.end()
	}

	toCamelCase(string) {
		// make the string camelcased
		return string.replace(/[^a-zA-Z0-9]+(.)/g, (match, character) => character.toUpperCase())
	}
}

module.exports = branchQuestions
