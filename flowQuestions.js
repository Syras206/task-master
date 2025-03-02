const fs = require("fs")
const { Quizzer, Questioner } = require("terminal-quizzer")

class flowQuestions {
	stages = {
		askCustomQuestions: () => this.stageAskCustomQuestions(),
		complete: () => this.stageComplete(),
	}

	constructor() {
		this.quizzer = new Quizzer(this)
		this.questioner = new Questioner()
	}

	askNextQuestion(questions) {
		let self = this
		// skip if we have no questions left
		if (questions.length > 0) {
			// get the next question
			const question = questions.shift()
			// skip if it is empty
			if (question?.length > 0) {
				// ask the question
				this.questioner
					.askQuestion(`${question} ${this.questioner.CYAN}[Press enter key to continue]:`)
					.then(() => {
						self.askNextQuestion(questions)
					})
			} else {
				// no more questions left so run the tests stage
				self.quizzer.runStage("complete")
			}
		} else {
			// no more questions left so run the tests stage
			self.quizzer.runStage("complete")
		}
	}

	// initialise the class
	init() {
		// set the stage
		return this.quizzer.start()
	}

	async stageAskCustomQuestions() {
		let self = this
		const filePath = `./customFlowQuestions.json`
		const data = await fs.promises.readFile(filePath, "utf8")
		const questions = JSON.parse(data)

		self.askNextQuestion(questions)
	}

	stageComplete() {
		this.quizzer.end()
	}
}

module.exports = flowQuestions