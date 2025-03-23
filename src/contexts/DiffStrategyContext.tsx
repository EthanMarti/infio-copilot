import {
	PropsWithChildren,
	createContext,
	useContext,
	useMemo
} from 'react'

import { DiffStrategy } from '../core/diff/DiffStrategy'


const DiffStrategyContext = createContext<DiffStrategy>(null)

export function DiffStrategyProvider({
	diffStrategy,
	children,
}: PropsWithChildren<{ diffStrategy: DiffStrategy }>) {

	const value = useMemo(() => {
		return diffStrategy
	}, [diffStrategy])

	return <DiffStrategyContext.Provider value={value}>{children}</DiffStrategyContext.Provider>
}

export function useDiffStrategy() {
	const context = useContext(DiffStrategyContext)
	if (!context) {
		throw new Error('DiffStrategyContext is not initialized')
	}
	return context
}
