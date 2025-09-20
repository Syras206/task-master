const { Quizzer, Questioner } = require("terminal-quizzer")
const runTests = require("./runTests")

class setupQuestions {
	destinationBranch = null
	// the description variables which will be populated by responses
	runTesting = null
	// the stages available and the methods to call them
	stages = {
		destinationBranch: () => this.stageDestinationBranch(),
		runTesting: () => this.stageRunTesting(),
		complete: () => this.stageComplete(),
	}

	// run tests object populated on instantiation
	runTests = new runTests()

	constructor(options) {
		this.questioner = new Questioner()
		this.quizzer = new Quizzer(this)
		// loop through options and patch it into this object
		for (let key in options) {
			this[key] = options[key]
		}
	}

	// initialise the class
	init() {
		// set the stage
		return this.quizzer.start()
	}

	stageDestinationBranch() {
		let self = this

		console.log(
			`${this.questioner.RED}Destination:${this.questioner.NORMAL}`,
		)
		this.questioner
			.askQuestion("What is the destination branch?")
			.then((answer) => {
				self.destinationBranch = answer
				self.quizzer.runStage("runTesting")
			})
	}

	stageRunTesting() {
		let self = this

		this.questioner
			.showYesNoMenu("Do tests need to be run now?")
			.then((answer) => {
				if (answer) {
					self.runTesting = "y"
					this.runTests.init().then(() => {
						// test questions are complete
						self.quizzer.runStage("complete")
					})
				} else {
					self.runTesting = "n"
					self.quizzer.runStage("complete")
				}
			})
	}

	stageComplete() {
		this.quizzer.end()
	}
}

module.exports = setupQuestions