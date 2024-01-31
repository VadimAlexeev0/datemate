import { invariantResponse } from '@epic-web/invariant'
import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { NavLink, Outlet, useLoaderData } from '@remix-run/react'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import { requireUserId } from '#app/utils/auth.server'
import { prisma } from '#app/utils/db.server.ts'
import { cn } from '#app/utils/misc.tsx'

export async function loader({ request, params }: LoaderFunctionArgs) {
	const userId = await requireUserId(request)

	const match = await prisma.match.findFirst({
		select: {
			id: true,
			username: true,
			images: { select: { id: true } },
			// notes: { select: { id: true, title: true } },
		},
		where: { id: params.matchId, ownerId: userId },
	})

	invariantResponse(match, 'Match not found', { status: 404 })

	return json({ match })
}

export default function NotesRoute() {
	const data = useLoaderData<typeof loader>()

	const isOwner = true
	const ownerDisplayName = data.match.username
	const navLinkDefaultClassName =
		'line-clamp-2 block rounded-l-full py-2 pl-8 pr-6 text-base lg:text-xl'

	return (
		<main className="container flex h-full min-h-[400px] px-0 pb-12 md:px-8">
			<div className="grid w-full grid-cols-4 bg-muted pl-2 md:container md:rounded-3xl md:pr-0">
				<div className="relative col-span-1">
					<div className="absolute inset-0 flex flex-col">
						{/* <Link
							to={`/users/${data.match.username}`}
							className="flex flex-col items-center justify-center gap-2 bg-muted pb-4 pl-8 pr-4 pt-12 lg:flex-row lg:justify-start lg:gap-4"
						> */}
						{/* <img
								src={getUserImgSrc(data.owner.image?.id)}
								alt={ownerDisplayName}
								className="h-16 w-16 rounded-full object-cover lg:h-24 lg:w-24"
							/> */}
						<h1 className="pb-4 pl-8 pr-4 pt-12 text-center text-base font-bold md:text-lg lg:text-left lg:text-2xl">
							Chat's with {ownerDisplayName}
						</h1>
						{/* </Link> */}
						<ul className="overflow-y-auto overflow-x-hidden pb-12">
							{isOwner ? (
								<li className="p-1 pr-0">
									<NavLink
										to="new"
										className={({ isActive }) =>
											cn(navLinkDefaultClassName, isActive && 'bg-accent')
										}
									>
										<Icon name="plus">New Chat</Icon>
									</NavLink>
								</li>
							) : null}
							{/* {data.match.notes.map(note => (
								<li key={note.id} className="p-1 pr-0">
									<NavLink
										to={note.id}
										preventScrollReset
										prefetch="intent"
										className={({ isActive }) =>
											cn(navLinkDefaultClassName, isActive && 'bg-accent')
										}
									>
										{note.title}
									</NavLink>
								</li>
							))} */}
						</ul>
					</div>
				</div>
				<div className="relative col-span-3 bg-accent md:rounded-r-3xl">
					<Outlet />
				</div>
			</div>
		</main>
	)
}

export function ErrorBoundary() {
	return (
		<GeneralErrorBoundary
			statusHandlers={{
				404: ({ params }) => (
					<p>No user with the username "{params.username}" exists</p>
				),
			}}
		/>
	)
}
