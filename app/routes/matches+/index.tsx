import { json, redirect, type LoaderFunctionArgs } from '@remix-run/node'
import { Link, useLoaderData } from '@remix-run/react'
import { z } from 'zod'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { ErrorList } from '#app/components/forms.tsx'
import { SearchBar } from '#app/components/search-bar.tsx'
import { Button } from '#app/components/ui/button'
import { prisma } from '#app/utils/db.server.ts'
import { cn, useDelayedIsPending } from '#app/utils/misc.tsx'

const MatchSearchResultSchema = z.object({
	id: z.string(),
	username: z.string(),
	gender: z.string(),
})

const MatchSearchResultsSchema = z.array(MatchSearchResultSchema)

export async function loader({ request }: LoaderFunctionArgs) {
	const searchTerm = new URL(request.url).searchParams.get('search')
	if (searchTerm === '') {
		return redirect('/matches')
	}

	const like = `%${searchTerm ?? ''}%`
	const rawMatches = await prisma.$queryRaw`
		SELECT Match.id, Match.username, Match.description, Match.gender
		FROM Match
		WHERE Match.username LIKE ${like}
		ORDER BY Match.updatedAt DESC
		LIMIT 50
	`

	const result = MatchSearchResultsSchema.safeParse(rawMatches)
	if (!result.success) {
		return json({ status: 'error', error: result.error.message } as const, {
			status: 400,
		})
	}
	return json({ status: 'idle', matches: result.data } as const)
}

export default function UsersRoute() {
	const data = useLoaderData<typeof loader>()
	const isPending = useDelayedIsPending({
		formMethod: 'GET',
		formAction: '/matches',
	})

	if (data.status === 'error') {
		console.error(data.error)
	}

	return (
		<div className="container mb-48 mt-36 flex flex-col items-center justify-center gap-6">
			<div className="flex items-end gap-4">
				<h1 className="text-h1">Your matches</h1>

				<Button asChild variant="secondary" className="text-xl font-semibold">
					<Link to="/matches/new">Create New</Link>
				</Button>
			</div>
			<div className="w-full max-w-[700px]">
				<SearchBar status={data.status} autoFocus autoSubmit />
			</div>
			<main>
				{data.status === 'idle' ? (
					data.matches.length ? (
						<ul
							className={cn(
								'flex w-full flex-wrap items-center justify-center gap-4 delay-200',
								{ 'opacity-50': isPending },
							)}
						>
							{data.matches.map(user => (
								<li key={user.id}>
									<Link
										to={user.id + '/chats'}
										className="flex h-36 w-44 flex-col items-center justify-center rounded-lg bg-muted px-5 py-3"
									>
										{/* <img
											alt={user.name ?? user.username}
											src={getUserImgSrc(user.imageId)}
											className="h-16 w-16 rounded-full"
										/> */}
										{/* {user.name ? (
											<span className="w-full overflow-hidden text-ellipsis whitespace-nowrap text-center text-body-md">
												{user.name}
											</span>
										) : null} */}
										<span className="w-full overflow-hidden text-ellipsis text-center text-body-md text-primary">
											{user.username}
										</span>
										<span className="w-full overflow-hidden text-ellipsis text-center text-body-sm text-muted-foreground">
											{user.gender}
										</span>
									</Link>
								</li>
							))}
						</ul>
					) : (
						<p>No matches found</p>
					)
				) : data.status === 'error' ? (
					<ErrorList errors={['There was an error parsing the results']} />
				) : null}
			</main>
		</div>
	)
}

export function ErrorBoundary() {
	return <GeneralErrorBoundary />
}
