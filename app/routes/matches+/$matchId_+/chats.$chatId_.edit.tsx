import { invariantResponse } from "@epic-web/invariant"
import { json, type LoaderFunctionArgs } from "@remix-run/node"
import { useLoaderData } from "@remix-run/react"
import { GeneralErrorBoundary } from "#app/components/error-boundary.tsx"
// import { requireUserId } from "#app/utils/auth.server.ts"
import { prisma } from "#app/utils/db.server.ts"
import { ChatEditor, action } from "./__chat-editor.tsx"

export { action }

export async function loader({ params, request }: LoaderFunctionArgs) {
	// const userId = await requireUserId(request)

	const chat = await prisma.chat.findFirst({
		select: {
			id: true,
			title: true,
			content: true,
			images: {
				select: {
					id: true,
				},
			},
			matchId: true,
		},
		where: {
			id: params.noteId,
			matchId: params.matchId,
		},
	})
	invariantResponse(chat, "Not found", { status: 404 })
	return json({ chat: chat })
}

export default function NoteEdit() {
	const data = useLoaderData<typeof loader>()

	return <ChatEditor chat={data.chat} matchId={data.chat.matchId} />
}

export function ErrorBoundary() {
	return (
		<GeneralErrorBoundary
			statusHandlers={{
				404: ({ params }) => (
					<p>No note with the id "{params.noteId}" exists</p>
				),
			}}
		/>
	)
}
