const fs = require("fs")
const { Quizzer, Questioner } = require("terminal-quizzer")

class prQuestions {
	// the description variables which will be populated by responses
	branchMerged = null
	bugFixDetail = null
	existingPatternDescription = null
	impact = null
	isBugFix = null
	otherPrs = null
	purposeProblem = null
	purposeSolution = null
	purposeSummary = null
	sqlUpdates = null
	supportTicket = null
	testing = null
	translations = null

	// the stages available and the methods to call them
	stages = {
		purposeSummary: () => this.stagePurposeSummary(),
		purposeProblem: () => this.stagePurposeProblem(),
		purposeSolution: () => this.stagePurposeSolution(),
		impact: () => this.stageImpact(),
		isBugFix: () => this.stageIsBugFix(),
		bugFixDetail: () => this.stageBugFixDetail(),
		testing: () => this.stageTesting(),
		branchMerged: () => this.stageBranchMerged(),
		otherPrs: () => this.stageOtherPrs(),
		sqlUpdates: () => this.stageSqlUpdates(),
		supportTicket: () => this.stageSupportTicket(),
		translations: () => this.stageTranslations(),
		complete: () => this.stageComplete(),
	}

	constructor(options) {
		this.questioner = new Questioner()
		this.quizzer = new Quizzer(this)
		// loop through options and patch it into this object
		for (let key in options) {
			this[key] = options[key]
		}
	}

	get description() {
		let description = "### Purpose\n> \n> " + this.purposeSummary
			+ "\n> \n> :question: **Problem:**\n" + this.purposeProblem
			+ "> \n> :star: **Solution:**\n" + this.purposeSolution + "\n\n"
			+ "### Impact\n\n" + this.impact + "\n\n"

		if (this.existingPatternDescription?.length > 0) {
			description += "### There is an existing pattern to solve this task\n\n"
				+ this.existingPatternDescription + "\n\n"
		}

		if (this.isBugFix) {
			description += "### If a bug fix, how can it be reproduced in Production?\n\n"
				+ this.bugFixDetail + "\n\n"
		}

		description += "### What have you done in order to test this PR?\n\n"
			+ "_I have tested this PR by doing the following:_\n\n" + this.testing + "\n\n"
			+ "### Dependencies\n\n"
			+ "1. Has the target branch been merged into the branch?" + "\n" + this.branchMerged + "\n"
			+ "2. Are there any other PRs for other systems (Include related PR URLs)" + "\n" + this.otherPrs + "\n"
			+ "3. Included SQL updates?" + "\n" + this.sqlUpdates + "\n"
			+ "4. Is this pull request linked to a ticket? (Include a URL)" + "\n" + this.supportTicket + "\n"
			+ "5. Does this add/edit/remove any translations?)" + "\n" + this.translations

		return description
	}

	// initialise the class
	init() {
		// set the stage
		return this.quizzer.start()
	}

	stageBranchMerged() {
		let self = this

		let title = `${this.questioner.RED}Dependencies:${this.questioner.NORMAL}`
		this.questioner
			.confirm({
				message: "Has the target branch been merged into the branch?",
				title: title,
				default: true,
			})
			.then((answer) => {
				if (answer) {
					self.branchMerged = "\t**Yes**"
					self.quizzer.runStage("otherPrs")
				} else {
					self.branchMerged = "\t**No**"
					self.quizzer.runStage("otherPrs")
				}
			})
	}

	stageBugFixDetail() {
		let self = this

		if (!this.isBugFix) {
			self.quizzer.runStage("testing")
		} else {
			console.log(`${this.questioner.RED}Bug Fix Details:${this.questioner.NORMAL}`)
			console.log(`${this.questioner.CYAN}How can it be reproduced in Production?${this.questioner.NORMAL}\n`)
			console.log(`${this.questioner.CYAN}List the steps taken to reproduce this in production.${this.questioner.NORMAL}\n`)

			this.questioner
				.askMultilineQuestion("Each line will display as a bullet point.", "- ")
				.then((answer) => {
					self.bugFixDetail = answer
					self.quizzer.runStage("testing")
				})
		}
	}

	stageComplete() {
		// store the description in tmp-pr-description.log so we have it
		let tmpFile = "tmp-pr-description.log"
		let description = this.description
		let descriptionFile = fs.openSync(tmpFile, "w")
		fs.writeSync(descriptionFile, description)
		fs.closeSync(descriptionFile)

		this.quizzer.end()
	}

	stageImpact() {
		let self = this
		console.log(`${this.questioner.RED}Impact:${this.questioner.NORMAL}`)
		console.log(`${this.questioner.CYAN}List the locations in the ui and codebase where the changes in this PR will impact.${this.questioner.NORMAL}\n`)

		this.questioner
			.askMultilineQuestion("Each line will display as a bullet point.", "- ")
			.then((answer) => {
				self.impact = answer
				self.quizzer.runStage("isBugFix")
			})
	}

	stageIsBugFix() {
		let self = this

		let title = `${this.questioner.RED}Bug Fix:${this.questioner.NORMAL}`
		this.questioner
			.confirm({
				message: "Is this a bug fix?",
				title: title,
				default: false,
			})
			.then((answer) => {
				if (answer) {
					self.isBugFix = true
					self.quizzer.runStage("bugFixDetail")
				} else {
					self.isBugFix = false
					self.quizzer.runStage("testing")
				}
			})
	}

	stageOtherPrs() {
		let self = this

		let title = `${this.questioner.RED}Linked PRs:${this.questioner.NORMAL}`
		this.questioner
			.confirm({
				message: "Are there any linked PRs for other systems?",
				title: title,
				default: false,
			})
			.then((answer) => {
				if (answer) {
					self.otherPrs = "\t**Yes**\n"
					this.questioner
						.askMultilineQuestion("list each linked PR that depends on this PR", "\t- ")
						.then((answer) => {
							self.otherPrs += answer
							self.quizzer.runStage("sqlUpdates")
						})
				} else {
					self.otherPrs = "\t**No**"
					self.quizzer.runStage("sqlUpdates")
				}
			})
	}

	stagePurposeProblem() {
		let self = this

		// if we already have a problem, just skip it
		if (this.purposeProblem) return this.quizzer.runStage("purposeSolution")

		console.log(`${this.questioner.RED}Problem:${this.questioner.NORMAL}`)

		this.questioner
			.askMultilineQuestion("Describe the problem this PR sets out to solve. Explain why this PR is needed.", "> \n> ~ ")
			.then((answer) => {
				self.purposeProblem = answer
				self.quizzer.runStage("purposeSolution")
			})
	}

	stagePurposeSolution() {
		let self = this

		// if we already have a solution, just skip it
		if (this.purposeSolution) return this.quizzer.runStage("impact")

		console.log(`${this.questioner.RED}Solution:${this.questioner.NORMAL}`)

		this.questioner
			.askMultilineQuestion("Describe the solution to the problem. This part justifies the approach you took.", "> \n> ~ ")
			.then((answer) => {
				self.purposeSolution = answer
				self.quizzer.runStage("impact")
			})
	}

	stagePurposeSummary() {
		let self = this

		// if we already have a summary, just skip it
		if (this.purposeSummary) return this.quizzer.runStage("purposeProblem")

		console.log(`${this.questioner.RED}Purpose:${this.questioner.NORMAL}`)
		console.log(`${this.questioner.CYAN}In this section we will concisely state what this PR sets out to achieve, ask yourself why we should merge this change.${this.questioner.NORMAL}\n`)
		console.log(`${this.questioner.CYAN}The purpose is broken down into a summary, a problem and a solution.${this.questioner.NORMAL}\n`)

		console.log(`${this.questioner.CYAN}Summary:${this.questioner.NORMAL}`)
		this.questioner
			.askQuestion("Write a summary of the PR. It is a short description of what the PR does.")
			.then((answer) => {
				self.purposeSummary = answer
				self.quizzer.runStage("purposeProblem")
			})
	}

	stageSqlUpdates() {
		let self = this

		let title = `${this.questioner.RED}Linked DB updates:${this.questioner.NORMAL}`
		this.questioner
			.confirm({
				message: "Included DB updates?",
				title: title,
				default: false,
			})
			.then((answer) => {
				if (answer) {
					self.sqlUpdates = "\t**Yes**"
					self.quizzer.runStage("supportTicket")
				} else {
					self.sqlUpdates = "\t**No**"
					self.quizzer.runStage("supportTicket")
				}
			})
	}

	stageSupportTicket() {
		let self = this

		let title = `${this.questioner.RED}Linked Tickets:${this.questioner.NORMAL}`
		this.questioner
			.confirm({
				message: "Is this pull request linked to a ticket?",
				title: title,
				default: false,
			})
			.then((answer) => {
				if (answer) {
					self.supportTicket = "\t**Yes**\n"
					this.questioner
						.askMultilineQuestion("list each ticket related to this PR", "\t- ")
						.then((answer) => {
							self.supportTicket += answer
							self.quizzer.runStage("translations")
						})
				} else {
					self.supportTicket = "\t**No**"
					self.quizzer.runStage("translations")
				}
			})
	}

	stageTesting() {
		let self = this

		console.log(`${this.questioner.RED}Testing:${this.questioner.NORMAL}`)
		console.log(`${this.questioner.CYAN}What have you done in order to test this PR?${this.questioner.NORMAL}\n`)
		console.log(`${this.questioner.CYAN}I have tested this PR by doing the following:${this.questioner.NORMAL}\n`)

		this.questioner
			.askMultilineQuestion("Each line will display as a bullet point.", "- ")
			.then((answer) => {
				self.testing = answer
				self.quizzer.runStage("branchMerged")
			})
	}

	stageTranslations() {
		let self = this

		let title = `${this.questioner.RED}Translation changes:${this.questioner.NORMAL}`
		this.questioner
			.confirm({
				message: "Does this add/edit/remove any translations?",
				title: title,
				default: false,
			})
			.then((answer) => {
				if (answer) {
					self.translations = "\t**Yes**"
					self.quizzer.runStage("complete")
				} else {
					self.translations = "\t**No**"
					self.quizzer.runStage("complete")
				}
			})
	}
}

module.exports = prQuestions