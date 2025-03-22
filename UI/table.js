const Colours = require("./colours")

class Table {

	colour = Colours.NORMAL
	columns = []
	rows = []

	/**
	 * Takes a string of text and ensures that it wraps / truncates to fit within the given width
	 */
	wrapText(text, width) {
		const words = text.split(' ')
		let lines = []
		let currentLine = ''

		for (let word of words) {
			if ((currentLine.length + word.length + 1) > width) {
				if (currentLine.length === 0) {
					lines.push(word.slice(0, width - 1) + '…')
				} else {
					lines.push(currentLine.trim())
					currentLine = word + ' '
				}
			} else {
				currentLine += word + ' '
			}
		}

		if (currentLine.trim().length > 0) {
			lines.push(currentLine.trim())
		}

		return lines
	}

	/**
	 * Renders the table within the console
	 */
	render() {
		const columns = this.columns
		const borderColor = this.colour || Colours.WHITE

		// Extract column labels and widths
		const columnLabels = columns.map(col => col.label)
		const colWidths = columns.map(col => col.width)

		const border = `${borderColor}+${colWidths.map(w => '-'.repeat(w + 2)).join('+')}+${Colours.NORMAL}`

		// Print header with table color
		console.log(border)
		console.log(`${borderColor}|${Colours.BOLD} ${columnLabels.map((label, i) => label.padEnd(colWidths[i])).join(` ${borderColor}|${Colours.BOLD} `)} ${borderColor}|${Colours.NORMAL}`)
		console.log(border)

		// Print each row with wrapped text
		this.rows.forEach(row => {
			let wrappedColumns = columns.map(col => this.wrapText(String(row[col.name]), col.width))
			let rowLines = Math.max(...wrappedColumns.map(col => col.length))

			for (let i = 0; i < rowLines; i++) {
				let line = columns.map((col, j) => {
					let cellColor = col.color || Colours.WHITE // Default to white if no color is set
					return `${cellColor}${(wrappedColumns[j][i] || '').padEnd(col.width)}${Colours.NORMAL}`
				})
				console.log(`${borderColor}| ${line.join(` ${borderColor}| `)} ${borderColor}|${Colours.NORMAL}`)
			}
			console.log(border)
		})
	}

	setColour(colour) {
		this.colour = colour
		return this
	}

	setColumns(columns) {
		this.columns = columns
		return this
	}

	setRows(rows) {
		this.rows = rows
		return this
	}

}

module.exports = Table