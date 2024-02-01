import { json, type LoaderFunctionArgs } from "@remix-run/node"
import { requireUserId } from "#app/utils/auth.server.ts"
import { ChatEditor, action } from "./__chat-editor.tsx"
import { useLoaderData } from "@remix-run/react"
import { prisma } from "#app/utils/db.server.ts"
import { invariantResponse } from "@epic-web/invariant"

export async function loader({ request, params }: LoaderFunctionArgs) {
	await requireUserId(request)

	const match = await prisma.match.findFirst({
		select: { id: true },
		where: {
			id: params.matchId,
		},
	})
	invariantResponse(match, "Not found", { status: 404 })

	return json({
		matchId: match.id,
	})
}

export { action }
export default function NewChat() {
	const data = useLoaderData<typeof loader>()
	return <ChatEditor matchId={data.matchId} />
}
