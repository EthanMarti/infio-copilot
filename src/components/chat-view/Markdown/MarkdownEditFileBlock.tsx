import { Check, CopyIcon, Edit, Loader2, X } from 'lucide-react'
import { PropsWithChildren, useMemo, useState } from 'react'

import { useDarkModeContext } from "../../../contexts/DarkModeContext"
import { t } from '../../../lang/helpers'
import { ApplyStatus, ToolArgs } from "../../../types/apply"

import { MemoizedSyntaxHighlighterWrapper } from "./SyntaxHighlighterWrapper"

export default function MarkdownEditFileBlock({
	mode,
	applyStatus,
	onApply,
	language,
	path,
	startLine,
	endLine,
	children,
}: PropsWithChildren<{
	mode: string
	applyStatus: ApplyStatus
	onApply: (args: ToolArgs) => void
	language?: string
	path?: string
	startLine?: number
	endLine?: number
}>) {
	const [copied, setCopied] = useState(false)
	const [applying, setApplying] = useState(false)
	const { isDarkMode } = useDarkModeContext()

	const wrapLines = useMemo(() => {
		return !language || ['markdown'].includes(language)
	}, [language])

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(String(children))
			setCopied(true)
			setTimeout(() => setCopied(false), 2000)
		} catch (err) {
			console.error('Failed to copy text: ', err)
		}
	}

	const handleApply = async () => {
		if (applyStatus !== ApplyStatus.Idle) {
			return
		}
		setApplying(true)
		onApply({
			// @ts-ignore
			type: mode,
			filepath: path,
			content: String(children),
			startLine,
			endLine
		})
	}

	return (
		<div className={`infio-chat-code-block ${path ? 'has-filename' : ''} infio-reasoning-block`}>
			<div className={'infio-chat-code-block-header'}>
				{path && (
					<div className={'infio-chat-code-block-header-filename'}>
						<Edit size={10} className="infio-chat-code-block-header-icon" />
						{t('chat.reactMarkdown.editOrApplyDiff').replace('{mode}', mode).replace('{path}', path)}
					</div>
				)}
				<div className={'infio-chat-code-block-header-button'}>
					<button
						onClick={() => {
							handleCopy()
						}}
					>
						{copied ? (
							<>
								<Check size={10} /> {t('chat.reactMarkdown.copied')}
							</>
						) : (
							<>
								<CopyIcon size={10} /> {t('chat.reactMarkdown.copy')}
							</>
						)}
					</button>
					<button
						onClick={handleApply}
						className="infio-apply-button"
						disabled={applyStatus !== ApplyStatus.Idle || applying}
					>
						{applyStatus === ApplyStatus.Idle ? (
							applying ? (
								<>
									<Loader2 className="spinner" size={14} /> {t('chat.reactMarkdown.applying')}
								</>
							) : (
								t('chat.reactMarkdown.apply')
							)
						) : applyStatus === ApplyStatus.Applied ? (
							<>
								<Check size={14} /> {t('chat.reactMarkdown.success')}
							</>
						) : (
							<>
								<X size={14} /> {t('chat.reactMarkdown.failed')}
							</>
						)}
					</button>
				</div>
			</div>
			<div className="infio-reasoning-content-wrapper">
				<MemoizedSyntaxHighlighterWrapper
					isDarkMode={isDarkMode}
					language={language}
					hasFilename={!!path}
					wrapLines={wrapLines}
				>
					{String(children)}
				</MemoizedSyntaxHighlighterWrapper>
			</div>
		</div>
	)
}
