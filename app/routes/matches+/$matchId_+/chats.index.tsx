import { type MetaFunction } from '@remix-run/react'
import { type loader as notesLoader } from './chats.tsx'

export default function NotesIndexRoute() {
	return (
		<div className="container pt-12">
			<p className="text-body-md">Select a chat</p>
		</div>
	)
}

export const meta: MetaFunction<
	null,
	{ 'routes/matches+/$matchId_+/chats': typeof notesLoader }
> = ({ params, matches }) => {
	const notesMatch = matches.find(
		m => m.id === 'routes/matches+/$matchId_+/chats',
	)
	const displayName = notesMatch?.data?.match.username ?? params.username
	// const noteCount = notesMatch?.data?.match.chats.length ?? 0
	// const notesText = noteCount === 1 ? 'note' : 'notes'
	return [
		{ title: `${displayName}'s Chats | Date Mate` },
		// {
		// 	name: 'description',
		// 	content: `Checkout ${displayName}'s ${noteCount} ${notesText} on Epic Notes`,
		// },
	]
}
