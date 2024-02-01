import { type LoaderFunctionArgs, json } from "@remix-run/node"

import { Button } from "#app/components/ui/button"
import { Label } from "#app/components/ui/label"
import { RadioGroup, RadioGroupItem } from "#app/components/ui/radio-group"
import { requireUserId } from "#app/utils/auth.server"
import { prisma } from "#app/utils/db.server"
import { invariantResponse } from "@epic-web/invariant"
import { useLoaderData } from "@remix-run/react"
import { useState } from "react"

const tones = [
	{
		name: "Funny",
		prompt: "",
	},
	{
		name: "Cheesy",
		prompt: "",
	},
	{
		name: "Dirty",
		prompt: "",
	},
	{
		name: "Polite",
		prompt: "",
	},
	{
		name: "Casual",
		prompt: "",
	},
	{
		name: "Assertive",
		prompt: "",
	},
	{
		name: "Empathetic",
		prompt: "",
	},
	{
		name: "Concise",
		prompt: "",
	},
	{
		name: "Playful",
		prompt: "",
	},
]

export async function loader({ params, request }: LoaderFunctionArgs) {
	await requireUserId(request)

	const match = await prisma.match.findUnique({
		where: {
			id: params.matchId,
		},
		select: {
			id: true,
			starters: true,
		},
	})
	invariantResponse(match, "Not found", { status: 404 })

	return json({
		id: match.id,
		starters: match.starters,
	})
}

export default function ChatStarters() {
	const { id, starters } = useLoaderData<typeof loader>()

	const [content, setContent] = useState("")

	return (
		<div className="flex flex-col gap-4 p-4">
			<div className="flex w-full flex-col gap-4 rounded-xl bg-muted/80 p-4 shadow-xl shadow-accent backdrop-blur-sm">
				<div>
					<span className="text-h5">Tone:</span>
					<RadioGroup defaultValue="option-one">
						{tones.map(({ name, prompt }) => (
							<div
								className="flex items-center space-x-2"
								key={name}
							>
								<RadioGroupItem value={name} id={name} />
								<Label htmlFor={name}>{name}</Label>
							</div>
						))}
					</RadioGroup>
				</div>
				<Button
					onClick={event => {
						event.preventDefault()

						const sse = new EventSource(
							`/resources/completions?${new URLSearchParams({ tone: "polite", matchId: id })}`,
						)

						setContent("")

						sse.addEventListener("message", event => {
							setContent(
								prevTitle =>
									prevTitle +
									event.data.replaceAll("␣", "\n"),
							)
						})

						sse.addEventListener("error", event => {
							console.log("error: ", event)
							sse.close()
						})
					}}
				>
					Generate
				</Button>
			</div>
			<h1>Generated: {content}</h1>
			{starters.length > 0 ? (
				<h1>List of starters</h1>
			) : (
				<h1>No starters yet create one now</h1>
			)}
		</div>
	)
}
