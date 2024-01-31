import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { requireUserId } from '#app/utils/auth.server.ts'
import { MatchEditor, action } from './__match-editor.tsx'

export async function loader({ request }: LoaderFunctionArgs) {
	await requireUserId(request)
	return json({})
}

export { action }
export default function NewMatch() {
	return (
		<div className="container flex flex-col  justify-center gap-6">
			<h1 className="pt-4 text-center text-h2">Create new match</h1>
			<MatchEditor />
		</div>
	)
}
