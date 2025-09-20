const fs = require("fs")
const { Quizzer, Questioner } = require("terminal-quizzer")
const { exec } = require("child_process")

class runTests {
	stages = {
		runCustomTests: () => this.stageRunCustomTests(), complete: () => this.stageComplete(),
	}

	constructor() {
		this.quizzer = new Quizzer(this)
		this.questioner = new Questioner()
	}

	// initialise the class
	init() {
		// set the stage
		return this.quizzer.start()
	}

	async stageRunCustomTests() {
		let self = this
		const filePath = `./customTests.json`
		const data = await fs.promises.readFile(filePath, "utf8")
		const tests = JSON.parse(data)

		self.runNextTest(tests)
	}

	runNextTest(tests) {
		let self = this
		// skip if we have no tests left
		if (tests.length > 0) {
			// get the next test
			const test = tests.shift()
			// skip if it is empty
			if (test?.length > 0) {
				// ask for the test
				this.questioner
					.showYesNoMenu(`Run '${test}'? ${this.questioner.CYAN}`)
					.then((answer) => {
						if (answer) self.runTest(test)
						self.runNextTest(tests)
					})
			} else {
				// no more tests left so complete
				self.quizzer.runStage("complete")
			}
		} else {
			// no more tests left so complete
			self.quizzer.runStage("complete")
		}
	}

	runTest(testString) {
		// define the osascript commands
		const osascriptCommand = `
			tell application "Terminal"
			activate
			set newWindow to do script "${testString}"
			set background color of window 1 to {0, 0, 89000}
			end tell
		`

		// run the osascript
		exec(`osascript -e '${osascriptCommand}'`)
	}

	stageComplete() {
		this.quizzer.end()
	}
}

module.exports = runTests