// import * as vscode from "vscode"
import * as childProcess from "child_process"
import * as fs from "fs"
import * as path from "path"
import * as readline from "readline"

const isWindows = /^win/.test(process.platform)
const binName = isWindows ? "rg.exe" : "rg"

interface SearchResult {
	file: string
	line: number
	column: number
	match: string
	beforeContext: string[]
	afterContext: string[]
}

// Constants
const MAX_RESULTS = 300
const MAX_LINE_LENGTH = 500

/**
 * Truncates a line if it exceeds the maximum length
 * @param line The line to truncate
 * @param maxLength The maximum allowed length (defaults to MAX_LINE_LENGTH)
 * @returns The truncated line, or the original line if it's shorter than maxLength
 */
export function truncateLine(line: string, maxLength: number = MAX_LINE_LENGTH): string {
	return line.length > maxLength ? line.substring(0, maxLength) + " [truncated...]" : line
}

async function getBinPath(): Promise<string | undefined> {
	const binPath = path.join("/opt/homebrew/bin/", binName)
	return (await pathExists(binPath)) ? binPath : undefined
}

async function pathExists(path: string): Promise<boolean> {
	return new Promise((resolve) => {
		fs.access(path, (err) => {
			resolve(err === null)
		})
	})
}

async function execRipgrep(bin: string, args: string[]): Promise<string> {
	return new Promise((resolve, reject) => {
		const rgProcess = childProcess.spawn(bin, args)
		// cross-platform alternative to head, which is ripgrep author's recommendation for limiting output.
		const rl = readline.createInterface({
			input: rgProcess.stdout,
			crlfDelay: Infinity, // treat \r\n as a single line break even if it's split across chunks. This ensures consistent behavior across different operating systems.
		})

		let output = ""
		let lineCount = 0
		const maxLines = MAX_RESULTS * 5 // limiting ripgrep output with max lines since there's no other way to limit results. it's okay that we're outputting as json, since we're parsing it line by line and ignore anything that's not part of a match. This assumes each result is at most 5 lines.

		rl.on("line", (line) => {
			if (lineCount < maxLines) {
				output += line + "\n"
				lineCount++
			} else {
				rl.close()
				rgProcess.kill()
			}
		})

		let errorOutput = ""
		rgProcess.stderr.on("data", (data) => {
			errorOutput += data.toString()
		})
		rl.on("close", () => {
			if (errorOutput) {
				reject(new Error(`ripgrep process error: ${errorOutput}`))
			} else {
				resolve(output)
			}
		})
		rgProcess.on("error", (error) => {
			reject(new Error(`ripgrep process error: ${error.message}`))
		})
	})
}

export async function regexSearchFiles(
	directoryPath: string,
	regex: string,
): Promise<string> {
	const rgPath = await getBinPath()

	if (!rgPath) {
		throw new Error("Could not find ripgrep binary")
	}

	// 使用--glob参数排除.obsidian目录
	const args = [
		"--json", 
		"-e", 
		regex, 
		"--glob", 
		"!.obsidian/**", // 排除.obsidian目录及其所有子目录
		"--glob",
		"!.git/**",
		"--context", 
		"1", 
		directoryPath
	]

	let output: string
	try {
		output = await execRipgrep(rgPath, args)
		console.log("output", output)
	} catch (error) {
		console.error("Error executing ripgrep:", error)
		return "No results found"
	}
	const results: SearchResult[] = []
	let currentResult: Partial<SearchResult> | null = null

	output.split("\n").forEach((line) => {
		if (line) {
			try {
				const parsed = JSON.parse(line)
				if (parsed.type === "match") {
					if (currentResult) {
						results.push(currentResult as SearchResult)
					}

					// Safety check: truncate extremely long lines to prevent excessive output
					const matchText = parsed.data.lines.text
					const truncatedMatch = truncateLine(matchText)

					currentResult = {
						file: parsed.data.path.text,
						line: parsed.data.line_number,
						column: parsed.data.submatches[0].start,
						match: truncatedMatch,
						beforeContext: [],
						afterContext: [],
					}
				} else if (parsed.type === "context" && currentResult) {
					// Apply the same truncation logic to context lines
					const contextText = parsed.data.lines.text
					const truncatedContext = truncateLine(contextText)

					if (parsed.data.line_number < currentResult.line!) {
						currentResult.beforeContext!.push(truncatedContext)
					} else {
						currentResult.afterContext!.push(truncatedContext)
					}
				}
			} catch (error) {
				console.error("Error parsing ripgrep output:", error)
			}
		}
	})

	if (currentResult) {
		results.push(currentResult as SearchResult)
	}
	
	console.log("results", results)
	console.log("currentResult", currentResult)

	return formatResults(results, directoryPath)
}

function formatResults(results: SearchResult[], cwd: string): string {
	const groupedResults: { [key: string]: SearchResult[] } = {}

	let output = ""
	if (results.length >= MAX_RESULTS) {
		output += `Showing first ${MAX_RESULTS} of ${MAX_RESULTS}+ results. Use a more specific search if necessary.\n\n`
	} else {
		output += `Found ${results.length === 1 ? "1 result" : `${results.length.toLocaleString()} results`}.\n\n`
	}

	// Group results by file name
	results.slice(0, MAX_RESULTS).forEach((result) => {
		const relativeFilePath = path.relative(cwd, result.file)
		if (!groupedResults[relativeFilePath]) {
			groupedResults[relativeFilePath] = []
		}
		groupedResults[relativeFilePath].push(result)
	})

	for (const [filePath, fileResults] of Object.entries(groupedResults)) {
		output += `${filePath.toPosix()}\n│----\n`

		fileResults.forEach((result, index) => {
			const allLines = [...result.beforeContext, result.match, ...result.afterContext]
			allLines.forEach((line) => {
				output += `│${line?.trimEnd() ?? ""}\n`
			})

			if (index < fileResults.length - 1) {
				output += "│----\n"
			}
		})

		output += "│----\n\n"
	}

	return output.trim()
}
