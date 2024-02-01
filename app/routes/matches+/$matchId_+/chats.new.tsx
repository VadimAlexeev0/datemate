import { json, type LoaderFunctionArgs } from "@remix-run/node"
import { requireUserId } from "#app/utils/auth.server.ts"
import { ChatEditor, action } from "./__chat-editor.tsx"

export async function loader({ request }: LoaderFunctionArgs) {
	await requireUserId(request)
	return json({})
}

export { action }
export default ChatEditor
