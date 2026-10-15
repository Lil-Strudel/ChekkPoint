import { createFileRoute, Link, useRouter } from "@tanstack/solid-router";
import { createMemo, createSignal, For, Show } from "solid-js";
import { z } from "zod";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "../components/ui/table";
import { getCollectionRows } from "../db/manage-db.functions";
import type {
	FetchCollectionResult,
	SerializableValue,
} from "../db/manage-db.server";
import {
	COLLECTION_CATEGORIES,
	COLLECTIONS,
	type CollectionCategory,
	type CollectionMetadata,
	getCollectionById,
	getCollectionsByCategory,
	isCollectionKey,
} from "../db/schema-metadata";

const manageDbSearchSchema = z.object({
	collection: z.string().optional(),
	view: z.enum(["schema", "data"]).optional(),
});

export const Route = createFileRoute("/manage-db")({
	validateSearch: (search) => manageDbSearchSchema.parse(search),
	loaderDeps: ({ search }) => ({
		collection: search.collection,
		view: search.view,
	}),
	loader: async ({ deps }): Promise<FetchCollectionResult | null> => {
		if (
			deps.view === "data" &&
			deps.collection &&
			deps.collection !== "overview" &&
			isCollectionKey(deps.collection)
		) {
			return await getCollectionRows({
				data: { collection: deps.collection, limit: 50 },
			});
		}
		return null;
	},
	component: ManageDbPage,
});

function ManageDbPage() {
	const search = Route.useSearch();
	const loaderData = Route.useLoaderData();
	const router = useRouter();

	const [filterQuery, setFilterQuery] = createSignal("");
	const [refreshing, setRefreshing] = createSignal(false);

	const activeCollectionId = createMemo(
		() => search().collection ?? "overview",
	);
	const activeView = createMemo(() => search().view ?? "schema");

	const selectedCollection = createMemo(() => {
		const id = activeCollectionId();
		if (id === "overview") return null;
		return getCollectionById(id) ?? null;
	});

	const filteredCategories = createMemo(() => {
		const query = filterQuery().trim().toLowerCase();
		const grouped = getCollectionsByCategory();
		if (!query) return grouped;

		const filtered = {} as Record<CollectionCategory, CollectionMetadata[]>;
		for (const cat of COLLECTION_CATEGORIES) {
			filtered[cat] = grouped[cat].filter(
				(col) =>
					col.name.toLowerCase().includes(query) ||
					col.tableName.toLowerCase().includes(query) ||
					col.shortDescription.toLowerCase().includes(query) ||
					col.badge.toLowerCase().includes(query),
			);
		}
		return filtered;
	});

	const totalMatchingCollections = createMemo(() => {
		const groups = filteredCategories();
		return Object.values(groups).reduce((acc, list) => acc + list.length, 0);
	});

	const handleRefresh = async () => {
		setRefreshing(true);
		try {
			await router.invalidate();
		} finally {
			setTimeout(() => setRefreshing(false), 300);
		}
	};

	return (
		<main class="page-wrap pb-24 pt-16">
			<p class="page-label">Database</p>
			<h1 class="page-title">Manage DB</h1>
			<p class="page-sub">
				Browse collections and tables, and watch the CQRS timing pipeline.
			</p>
			{/* Main Split-Pane Layout */}
			<div class="grid grid-cols-1 gap-6 lg:grid-cols-12">
				{/* Left Sidebar */}
				<aside class="lg:col-span-4 xl:col-span-3 2xl:col-span-2">
					<div class="lg:sticky lg:top-20 space-y-6">
						{/* Search Filter */}
						<Card class="p-4">
							<div class="relative">
								<Input
									type="text"
									placeholder="Search collections or tables..."
									value={filterQuery()}
									onInput={(e) => setFilterQuery(e.currentTarget.value)}
									class="text-xs h-9 pl-3 pr-8"
								/>
								<Show when={filterQuery()}>
									<button
										type="button"
										onClick={() => setFilterQuery("")}
										class="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
										title="Clear search"
									>
										✕
									</button>
								</Show>
							</div>
							<div class="mt-2 flex items-center justify-between text-xs text-muted-foreground px-1">
								<span>
									Showing {totalMatchingCollections()} of {COLLECTIONS.length}
								</span>
								<Show when={filterQuery()}>
									<span class="font-semibold text-forest">Filtered</span>
								</Show>
							</div>
						</Card>

						{/* Overview Button */}
						<Link
							to="/manage-db"
							search={{ collection: "overview", view: "schema" }}
							class={`w-full flex items-center justify-between p-3 rounded-2xl border text-sm font-semibold transition-all ${
								activeCollectionId() === "overview"
									? "border-forest bg-card text-foreground shadow-xs"
									: "border-border bg-card/50 text-muted-foreground hover:bg-card hover:text-foreground"
							}`}
						>
							<div class="flex items-center gap-2">
								<span class="text-base">🗺️</span>
								<span>Domain Overview</span>
							</div>
							<Badge variant="chip" class="text-xs">
								Map
							</Badge>
						</Link>

						{/* Categorized Collection Navigation */}
						<div
							class="space-y-6 max-h-[calc(100vh-18rem)] overflow-y-auto overscroll-contain pr-1"
							style={{ "overscroll-behavior": "contain" }}
						>
							<For each={COLLECTION_CATEGORIES}>
								{(category) => {
									const collections = () => filteredCategories()[category];
									return (
										<Show when={collections().length > 0}>
											<div class="space-y-1.5">
												<div class="flex items-center justify-between px-2 pt-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
													<span>{category}</span>
													<span class="text-[10px] font-mono opacity-70">
														{collections().length}
													</span>
												</div>

												<div class="space-y-1">
													<For each={collections()}>
														{(col) => {
															const isSelected = () =>
																activeCollectionId() === col.id;
															return (
																<Link
																	to="/manage-db"
																	search={{
																		collection: col.id,
																		view: activeView(),
																	}}
																	class={`group flex flex-col p-2.5 rounded-xl border text-left transition-all ${
																		isSelected()
																			? "border-forest bg-card text-foreground shadow-xs"
																			: "border-transparent bg-card/40 text-muted-foreground hover:border-border hover:bg-card/80 hover:text-foreground"
																	}`}
																>
																	<div class="flex items-center justify-between gap-1">
																		<span class="text-sm font-bold truncate">
																			{col.name}
																		</span>
																		<Badge
																			variant={isSelected() ? "forest" : "chip"}
																			class="text-[10px] py-0 px-1.5 font-medium"
																		>
																			{col.badge}
																		</Badge>
																	</div>
																	<span class="text-xs font-mono text-muted-foreground opacity-80 mt-0.5 truncate">
																		{col.tableName}
																	</span>
																</Link>
															);
														}}
													</For>
												</div>
											</div>
										</Show>
									);
								}}
							</For>
						</div>
					</div>
				</aside>

				{/* Right Main Stage */}
				<section class="lg:col-span-8 xl:col-span-9 2xl:col-span-10 space-y-6">
					<Show
						when={selectedCollection()}
						fallback={
							<DomainOverviewView
								onSelectCollection={(id, view) => {
									router.navigate({
										to: "/manage-db",
										search: { collection: id, view },
									});
								}}
							/>
						}
					>
						{(col) => (
							<div class="space-y-6">
								{/* Collection Header Bar */}
								<Card class="p-6">
									<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
										<div>
											<div class="flex flex-wrap items-center gap-2 mb-2">
												<Link
													to="/manage-db"
													search={{ collection: "overview", view: "schema" }}
													class="text-xs font-semibold text-forest hover:underline flex items-center gap-1"
												>
													← Overview
												</Link>
												<span class="text-border">•</span>
												<Badge variant="chip" class="text-xs">
													{col().category}
												</Badge>
												<Badge
													variant="forest"
													class="font-mono text-xs font-semibold"
												>
													{col().badge}
												</Badge>
											</div>

											<h2 class="text-2xl font-display font-normal text-foreground flex items-center gap-3">
												<span>{col().name}</span>
												<code class="text-xs font-mono font-normal bg-black/5 px-2 py-1 rounded">
													{col().tableName}
												</code>
											</h2>
											<p class="mt-1 text-sm text-muted-foreground">
												{col().shortDescription}
											</p>
										</div>

										{/* View Mode Toggle */}
										<div class="flex items-center rounded-xl border border-border bg-surface p-1 self-start">
											<Button
												variant={
													activeView() === "schema" ? "default" : "ghost"
												}
												size="sm"
												class="h-8 text-xs font-bold"
												onClick={() =>
													router.navigate({
														to: "/manage-db",
														search: { collection: col().id, view: "schema" },
													})
												}
											>
												Schema
											</Button>
											<Button
												variant={activeView() === "data" ? "default" : "ghost"}
												size="sm"
												class="h-8 text-xs font-bold"
												onClick={() =>
													router.navigate({
														to: "/manage-db",
														search: { collection: col().id, view: "data" },
													})
												}
											>
												Data
											</Button>
										</div>
									</div>
								</Card>

								{/* Conditional View: Schema vs Data */}
								<Show
									when={activeView() === "data"}
									fallback={<CollectionSchemaView collection={col()} />}
								>
									<CollectionDataView
										collection={col()}
										loaderData={loaderData()}
										refreshing={refreshing()}
										onRefresh={handleRefresh}
									/>
								</Show>
							</div>
						)}
					</Show>
				</section>
			</div>
		</main>
	);
}

// ============================================================================
// DOMAIN OVERVIEW SUBVIEW
// ============================================================================

function DomainOverviewView(props: {
	onSelectCollection: (id: string, view: "schema" | "data") => void;
}) {
	return (
		<div class="space-y-6">
			{/* Domain Metrics Grid */}
			<div class="grid grid-cols-2 gap-5 sm:grid-cols-4">
				<Card class="p-5">
					<span class="block text-xs font-semibold text-muted-foreground">
						Domain Collections
					</span>
					<span class="text-3xl font-display font-normal text-foreground mt-1 block">
						{COLLECTIONS.length}
					</span>
				</Card>
				<Card class="p-5">
					<span class="block text-xs font-semibold text-muted-foreground">
						Architectural Categories
					</span>
					<span class="text-3xl font-display font-normal text-foreground mt-1 block">
						{COLLECTION_CATEGORIES.length}
					</span>
				</Card>
				<Card class="p-5">
					<span class="block text-xs font-semibold text-muted-foreground">
						Write Plane Ledger
					</span>
					<span class="text-3xl font-display font-normal text-forest mt-1 block">
						1 (Immutable)
					</span>
				</Card>
				<Card class="p-5">
					<span class="block text-xs font-semibold text-muted-foreground">
						Read Projections
					</span>
					<span class="text-3xl font-display font-normal text-forest mt-1 block">
						1 (Standings)
					</span>
				</Card>
			</div>

			{/* Architectural CQRS Pipeline Visualizer */}
			<Card class="p-6 sm:p-8">
				<div class="mb-4 flex items-center justify-between">
					<h3 class="text-lg font-display font-normal text-foreground flex items-center gap-2">
						<span>⚡</span>
						<span>High-Performance Timing Domain Pipeline</span>
					</h3>
					<Badge variant="chip" class="text-xs">
						CQRS Architecture
					</Badge>
				</div>

				<p class="text-sm text-muted-foreground mb-6 max-w-5xl leading-relaxed">
					ChekkPoint cleanly separates continuous high-throughput hardware pulse
					ingestion (<strong>Write Plane</strong>) from calculated checkpoint
					leaderboards and split projections (<strong>Read Plane</strong>),
					governed by strict audit controls and multi-tenant hierarchies.
				</p>

				{/* Pipeline Diagram Cards */}
				<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
					<Card class="p-5 border-l-4 border-l-forest">
						<span class="text-xs font-bold uppercase tracking-wider text-forest">
							1. Configuration & Roster
						</span>
						<h4 class="text-base font-bold text-foreground mt-1">
							Hierarchy & Courses
						</h4>
						<p class="text-xs text-muted-foreground mt-1 leading-relaxed">
							Organizations host EventGroups containing Events. Courses map
							physical TimingPoints to logical CourseSplits. People register as
							Entrants.
						</p>
						<div class="mt-3 flex flex-wrap gap-1">
							<Badge variant="chip" class="text-[10px] py-0 px-1.5">
								organizations
							</Badge>
							<Badge variant="chip" class="text-[10px] py-0 px-1.5">
								eventGroups
							</Badge>
							<Badge variant="chip" class="text-[10px] py-0 px-1.5">
								courses
							</Badge>
							<Badge variant="chip" class="text-[10px] py-0 px-1.5">
								people
							</Badge>
							<Badge variant="chip" class="text-[10px] py-0 px-1.5">
								entrants
							</Badge>
						</div>
					</Card>

					<Card class="p-5 border-l-4 border-l-forest-deep">
						<span class="text-xs font-bold uppercase tracking-wider text-forest-deep">
							2. Write Plane (Audit Ledger)
						</span>
						<h4 class="text-base font-bold text-foreground mt-1">
							Immutable UTC Pulses
						</h4>
						<p class="text-xs text-muted-foreground mt-1 leading-relaxed">
							RFID mats, lasers, ham radios, and offline PWAs append raw pulses.
							Zero updates or deletes. Replaces loose boolean flags with
							single-status validation.
						</p>
						<div class="mt-3 flex flex-wrap gap-1">
							<Badge variant="forest" class="text-[10px] py-0 px-1.5 font-bold">
								rawTimingEvents
							</Badge>
							<Badge variant="chip" class="text-[10px] py-0 px-1.5">
								timingPoints
							</Badge>
						</div>
					</Card>

					<Card class="p-5 border-l-4 border-l-clay">
						<span class="text-xs font-bold uppercase tracking-wider text-clay">
							3. Read Plane & Operations
						</span>
						<h4 class="text-base font-bold text-foreground mt-1">
							Materialized Standings
						</h4>
						<p class="text-xs text-muted-foreground mt-1 leading-relaxed">
							Scoring workers project elapsed times, dwell seconds, and TSD
							penalties. Time allowances extend cutoffs; audits record every
							manual steward change.
						</p>
						<div class="mt-3 flex flex-wrap gap-1">
							<Badge variant="clay" class="text-[10px] py-0 px-1.5 font-bold">
								scoredSplitTimes
							</Badge>
							<Badge variant="chip" class="text-[10px] py-0 px-1.5">
								timeAllowances
							</Badge>
							<Badge variant="chip" class="text-[10px] py-0 px-1.5">
								splitTimeAudits
							</Badge>
						</div>
					</Card>

					<Card class="p-5 border-l-4 border-l-sage">
						<span class="text-xs font-bold uppercase tracking-wider text-forest-deep">
							4. Competitor History & Projections
						</span>
						<h4 class="text-base font-bold text-foreground mt-1">
							Athletic Intelligence & SAR
						</h4>
						<p class="text-xs text-muted-foreground mt-1 leading-relaxed">
							Multi-source scraping (UltraSignup, Strava, DUV, ITRA) with MFDA
							disambiguation. Pacing models predict split arrival windows and
							flag SAR/cutoff risks.
						</p>
						<div class="mt-3 flex flex-wrap gap-1">
							<Badge variant="sage" class="text-[10px] py-0 px-1.5 font-bold">
								personExternalProfiles
							</Badge>
							<Badge variant="sage" class="text-[10px] py-0 px-1.5 font-bold">
								personRaceHistory
							</Badge>
							<Badge variant="chip" class="text-[10px] py-0 px-1.5">
								personHistoricalSummaries
							</Badge>
							<Badge variant="chip" class="text-[10px] py-0 px-1.5">
								entrantHistoricalProjections
							</Badge>
						</div>
					</Card>
				</div>
			</Card>

			{/* Collection Directory Cards */}
			<section class="space-y-6">
				<div class="flex items-center justify-between">
					<h3 class="text-lg font-display font-normal text-foreground">
						All Domain Collections ({COLLECTIONS.length})
					</h3>
					<span class="text-xs text-muted-foreground">
						Click to inspect schema specification or live records
					</span>
				</div>

				<div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
					<For each={COLLECTIONS}>
						{(col) => (
							<Card class="p-5 flex flex-col justify-between hover:border-forest transition-all">
								<div>
									<div class="flex items-center justify-between gap-2 mb-2">
										<Badge variant="chip" class="text-[10px] py-0.5">
											{col.category}
										</Badge>
										<span class="text-xs font-mono font-semibold text-forest">
											{col.badge}
										</span>
									</div>

									<h4 class="text-base font-bold text-foreground flex items-center justify-between">
										<span>{col.name}</span>
										<code class="text-xs font-mono font-normal text-muted-foreground">
											{col.tableName}
										</code>
									</h4>

									<p class="mt-1.5 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
										{col.shortDescription}
									</p>

									<div class="mt-3 flex flex-wrap gap-1">
										<For each={col.fields.slice(0, 5)}>
											{(f) => (
												<span class="text-[10px] font-mono bg-black/5 text-foreground px-1.5 py-0.5 rounded">
													{f.name}
												</span>
											)}
										</For>
										<Show when={col.fields.length > 5}>
											<span class="text-[10px] font-mono text-muted-foreground self-center px-1">
												+{col.fields.length - 5} more
											</span>
										</Show>
									</div>
								</div>

								<div class="mt-4 pt-3 border-t border-border/60 flex items-center justify-between gap-2">
									<Button
										type="button"
										size="sm"
										onClick={() => props.onSelectCollection(col.id, "schema")}
										class="text-xs py-1.5 flex-1"
									>
										Schema
									</Button>
									<Button
										type="button"
										size="sm"
										variant="secondary"
										onClick={() => props.onSelectCollection(col.id, "data")}
										class="text-xs py-1.5 flex-1"
									>
										Data
									</Button>
								</div>
							</Card>
						)}
					</For>
				</div>
			</section>
		</div>
	);
}

// ============================================================================
// SCHEMA SPECIFICATION SUBVIEW
// ============================================================================

function CollectionSchemaView(props: { collection: CollectionMetadata }) {
	return (
		<div class="space-y-6">
			{/* Operational Purpose Narrative Callout */}
			<Alert variant="warning">
				<div class="flex items-start gap-3">
					<span class="text-xl">💡</span>
					<div>
						<AlertTitle>Operational Purpose & Edge Invariants</AlertTitle>
						<AlertDescription class="text-foreground">
							{props.collection.operationalPurpose}
						</AlertDescription>
					</div>
				</div>
			</Alert>

			{/* Relational Query Graph */}
			<Show when={props.collection.relationships.length > 0}>
				<Card class="p-6">
					<h3 class="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">
						Relational Connections ({props.collection.relationships.length})
					</h3>
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
						<For each={props.collection.relationships}>
							{(rel) => (
								<Link
									to="/manage-db"
									search={{
										collection: rel.targetCollectionId,
										view: "schema",
									}}
									class="group"
								>
									<Card class="p-4 hover:border-forest transition-all flex flex-col justify-between h-full">
										<div>
											<div class="flex items-center justify-between mb-1">
												<Badge
													variant="sand"
													class="text-[10px] py-0 px-1.5 font-bold uppercase tracking-wider"
												>
													{rel.kind === "belongsTo"
														? "↑ Belongs To"
														: "↓ Has Many"}
												</Badge>
												<span class="text-xs font-mono text-muted-foreground">
													{rel.foreignKey}
												</span>
											</div>
											<span class="text-sm font-extrabold text-foreground group-hover:text-forest">
												{rel.targetCollectionId} →
											</span>
											<p class="text-xs text-muted-foreground mt-1">
												{rel.description}
											</p>
										</div>
									</Card>
								</Link>
							)}
						</For>
					</div>
				</Card>
			</Show>

			{/* Documented Fields & Columns Table */}
			<Card class="p-6">
				<div class="flex items-center justify-between mb-3">
					<h3 class="text-sm font-bold uppercase tracking-wider text-muted-foreground">
						Table Columns & Types ({props.collection.fields.length})
					</h3>
					<Badge variant="chip" class="font-mono text-xs">
						{props.collection.tableName}
					</Badge>
				</div>

				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Column</TableHead>
							<TableHead>PostgreSQL Type</TableHead>
							<TableHead>Constraints</TableHead>
							<TableHead>Default</TableHead>
							<TableHead>Documentation</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						<For each={props.collection.fields}>
							{(f) => (
								<TableRow>
									<TableCell class="font-mono text-xs font-bold text-foreground">
										{f.name}
									</TableCell>
									<TableCell class="font-mono text-xs text-forest">
										{f.type}
									</TableCell>
									<TableCell>
										<div class="flex flex-wrap gap-1">
											<Show
												when={!f.nullable}
												fallback={
													<span class="text-[10px] text-muted-foreground font-mono">
														nullable
													</span>
												}
											>
												<Badge
													variant="destructive"
													class="text-[10px] py-0 px-1"
												>
													NOT NULL
												</Badge>
											</Show>
											<For each={f.constraints ?? []}>
												{(c) => (
													<Badge
														variant="chip"
														class="text-[10px] py-0 px-1 font-semibold"
													>
														{c}
													</Badge>
												)}
											</For>
										</div>
									</TableCell>
									<TableCell class="font-mono text-xs text-muted-foreground">
										{f.defaultValue ?? "—"}
									</TableCell>
									<TableCell class="text-xs text-foreground">
										{f.description}
									</TableCell>
								</TableRow>
							)}
						</For>
					</TableBody>
				</Table>
			</Card>

			{/* Enums Catalog */}
			<Show when={props.collection.enums && props.collection.enums.length > 0}>
				<Card class="p-6">
					<h3 class="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">
						PostgreSQL Enums ({props.collection.enums?.length})
					</h3>
					<div class="space-y-6">
						<For each={props.collection.enums}>
							{(e) => (
								<Card class="p-4">
									<h4 class="text-sm font-mono font-bold text-forest mb-2">
										enum "{e.name}"
									</h4>
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead>Value</TableHead>
												<TableHead>Label</TableHead>
												<TableHead>Domain Meaning</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											<For each={e.values}>
												{(val) => (
													<TableRow>
														<TableCell class="font-mono text-xs font-bold text-foreground">
															'{val.value}'
														</TableCell>
														<TableCell class="text-xs font-semibold text-foreground">
															{val.label}
														</TableCell>
														<TableCell class="text-xs text-muted-foreground">
															{val.description}
														</TableCell>
													</TableRow>
												)}
											</For>
										</TableBody>
									</Table>
								</Card>
							)}
						</For>
					</div>
				</Card>
			</Show>

			{/* Polymorphic JSONB Schemas */}
			<Show
				when={
					props.collection.polymorphicSchemas &&
					props.collection.polymorphicSchemas.length > 0
				}
			>
				<Card class="p-6">
					<div class="flex items-center justify-between mb-3">
						<h3 class="text-sm font-bold uppercase tracking-wider text-muted-foreground">
							Polymorphic JSONB Schemas
						</h3>
						<Badge variant="chip" class="text-xs">
							Zod Discriminated Unions
						</Badge>
					</div>

					<div class="space-y-6">
						<For each={props.collection.polymorphicSchemas}>
							{(poly) => (
								<Card class="p-4">
									<div class="mb-2">
										<h4 class="text-sm font-bold text-foreground">
											{poly.name}
										</h4>
										<p class="text-xs text-muted-foreground">
											{poly.description}
										</p>
									</div>

									<Table>
										<TableHeader>
											<TableRow>
												<TableHead>Field</TableHead>
												<TableHead>Type</TableHead>
												<TableHead>Description</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											<For each={poly.fields}>
												{(f) => (
													<TableRow>
														<TableCell class="font-mono text-xs font-bold text-foreground">
															{f.name}
														</TableCell>
														<TableCell class="font-mono text-xs text-forest">
															{f.type}
														</TableCell>
														<TableCell class="text-xs text-muted-foreground">
															{f.description}
														</TableCell>
													</TableRow>
												)}
											</For>
										</TableBody>
									</Table>
								</Card>
							)}
						</For>
					</div>
				</Card>
			</Show>

			{/* Database Indexes & Invariants */}
			<Show
				when={props.collection.indexes && props.collection.indexes.length > 0}
			>
				<Card class="p-6">
					<h3 class="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">
						Database Indexes ({props.collection.indexes.length})
					</h3>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Index Name</TableHead>
								<TableHead>Columns</TableHead>
								<TableHead>Type</TableHead>
								<TableHead>Query Performance Rationale</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							<For each={props.collection.indexes}>
								{(idx) => (
									<TableRow>
										<TableCell class="font-mono text-xs font-bold text-foreground">
											{idx.name}
										</TableCell>
										<TableCell class="font-mono text-xs text-forest">
											({idx.columns.join(", ")})
										</TableCell>
										<TableCell>
											<Badge
												variant={idx.unique ? "clay" : "chip"}
												class="text-[10px] py-0 px-1.5"
											>
												{idx.unique ? "UNIQUE" : "INDEX"}
											</Badge>
										</TableCell>
										<TableCell class="text-xs text-muted-foreground">
											{idx.rationale}
										</TableCell>
									</TableRow>
								)}
							</For>
						</TableBody>
					</Table>
				</Card>
			</Show>
		</div>
	);
}

// ============================================================================
// LIVE DATA SPREADSHEET SUBVIEW
// ============================================================================

function CollectionDataView(props: {
	collection: CollectionMetadata;
	loaderData: FetchCollectionResult | null;
	refreshing: boolean;
	onRefresh: () => void;
}) {
	const rows = createMemo(() => props.loaderData?.rows ?? []);
	const totalCount = createMemo(() => props.loaderData?.totalCount ?? 0);
	const error = createMemo(() => props.loaderData?.error);
	const isOffline = createMemo(() => props.loaderData?.isOffline ?? false);

	const columnKeys = createMemo(() => {
		const currentRows = rows();
		if (currentRows.length > 0) {
			return Object.keys(currentRows[0]);
		}
		return props.collection.fields.map((f) => f.name);
	});

	return (
		<div class="space-y-6">
			{/* Controls Bar */}
			<Card class="p-5 flex flex-wrap items-center justify-between gap-3">
				<div class="flex items-center gap-3">
					<span class="text-sm font-bold text-foreground">
						Records in{" "}
						<code class="font-mono">{props.collection.tableName}</code>:
					</span>
					<Badge variant="forest" class="font-mono font-bold text-xs">
						{totalCount()} row{totalCount() === 1 ? "" : "s"}
					</Badge>
					<span class="text-xs text-muted-foreground">
						(Showing up to 50 most recent records)
					</span>
				</div>

				<div class="flex items-center gap-2">
					<Button
						type="button"
						size="sm"
						onClick={props.onRefresh}
						disabled={props.refreshing}
						class="text-xs flex items-center gap-1.5"
					>
						<span class={props.refreshing ? "animate-spin" : ""}>🔄</span>
						<span>
							{props.refreshing ? "Refreshing..." : "Refresh Live Data"}
						</span>
					</Button>
				</div>
			</Card>

			{/* Database Offline or Query Error Banner */}
			<Show when={error()}>
				<Alert variant="destructive">
					<div class="flex items-start gap-3">
						<span class="text-xl">⚠️</span>
						<div class="space-y-1">
							<AlertTitle>
								{isOffline()
									? "PostgreSQL Database Offline or Unreachable"
									: "Query Execution Error"}
							</AlertTitle>
							<AlertDescription>
								<p class="text-xs font-mono bg-destructive/10 p-2 rounded border border-destructive/20 text-destructive-foreground">
									{error()}
								</p>
								<Show when={isOffline()}>
									<p class="text-xs text-muted-foreground mt-2">
										💡 Start local development services by running:{" "}
										<code class="font-mono bg-white/70 px-1 py-0.5 rounded font-bold">
											pnpm services:up
										</code>{" "}
										or{" "}
										<code class="font-mono bg-white/70 px-1 py-0.5 rounded font-bold">
											docker compose up -d
										</code>
										.
									</p>
								</Show>
							</AlertDescription>
						</div>
					</div>
				</Alert>
			</Show>

			{/* Data Spreadsheet Table */}
			<Show
				when={rows().length > 0}
				fallback={
					<Show when={!error()}>
						<Card class="p-12 text-center">
							<span class="text-3xl">📭</span>
							<h4 class="text-base font-bold text-foreground mt-2">
								No Records in Table
							</h4>
							<p class="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
								The <code class="font-mono">{props.collection.tableName}</code>{" "}
								table has zero rows recorded so far. Rows will appear here as
								races are configured or timing pulses are ingested.
							</p>
						</Card>
					</Show>
				}
			>
				<Table containerClass="max-h-[600px] overflow-auto">
					<TableHeader>
						<TableRow>
							<TableHead class="w-12 text-center text-muted-foreground">
								#
							</TableHead>
							<For each={columnKeys()}>
								{(key) => (
									<TableHead class="whitespace-nowrap font-mono">
										{key}
									</TableHead>
								)}
							</For>
						</TableRow>
					</TableHeader>
					<TableBody>
						<For each={rows()}>
							{(row, idx) => (
								<TableRow>
									<TableCell class="text-center font-mono text-[10px] text-muted-foreground opacity-60">
										{idx() + 1}
									</TableCell>
									<For each={columnKeys()}>
										{(colKey) => (
											<TableCell class="max-w-[420px] truncate align-top py-2">
												<CellValue value={row[colKey]} />
											</TableCell>
										)}
									</For>
								</TableRow>
							)}
						</For>
					</TableBody>
				</Table>
			</Show>
		</div>
	);
}

// ============================================================================
// CELL VALUE FORMATTER
// ============================================================================

function CellValue(props: { value: SerializableValue }) {
	const [expanded, setExpanded] = createSignal(false);

	if (props.value === null || props.value === undefined) {
		return <span class="font-mono text-muted-foreground/60 italic">null</span>;
	}

	if (typeof props.value === "boolean") {
		return (
			<Badge
				variant={props.value ? "forest" : "destructive"}
				class="text-[10px] py-0 px-1 font-bold"
			>
				{props.value ? "TRUE" : "FALSE"}
			</Badge>
		);
	}

	if (typeof props.value === "number") {
		return (
			<span class="font-mono font-semibold text-foreground">{props.value}</span>
		);
	}

	if (typeof props.value === "string") {
		// Check for UUID
		const isUuid =
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
				props.value,
			);
		if (isUuid) {
			return (
				<span
					class="font-mono text-[11px] text-muted-foreground"
					title={props.value}
				>
					{props.value.slice(0, 8)}…{props.value.slice(-4)}
				</span>
			);
		}

		// Check for ISO Date
		if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(props.value)) {
			const formatted = new Date(props.value).toLocaleString();
			return (
				<span class="font-mono text-[11px] text-foreground" title={props.value}>
					{formatted}
				</span>
			);
		}

		return <span>{props.value}</span>;
	}

	// JSON Object or Array
	return (
		<div class="relative">
			<Button
				type="button"
				variant="ghost"
				size="sm"
				onClick={() => setExpanded(!expanded())}
				class="h-6 text-[10px] font-mono bg-black/5 hover:bg-black/10 px-1.5 py-0.5 rounded text-forest font-semibold inline-flex items-center gap-1"
			>
				<span>
					{Array.isArray(props.value) ? `[${props.value.length}]` : "{…}"}
				</span>
				<span>{expanded() ? "▲" : "▼"}</span>
			</Button>
			<Show when={expanded()}>
				{(_) => (
					<pre class="mt-1.5 p-2 rounded bg-card text-foreground border border-border text-[10px] font-mono overflow-auto max-h-40 max-w-xs z-10 shadow-lg">
						{JSON.stringify(props.value, null, 2)}
					</pre>
				)}
			</Show>
		</div>
	);
}
