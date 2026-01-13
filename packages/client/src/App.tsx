import { useEffect, useState } from "react";

// API base URL - empty for same-origin (local dev), or set via env var for production
const API_URL = "https://atfeeds-api.stevedsimkins.workers.dev";

interface Document {
	uri: string;
	did: string;
	rkey: string;
	title: string;
	path: string | null;
	site: string | null;
	content: {
		$type: string;
		markdown?: string;
	} | null;
	textContent: string | null;
	publishedAt: string | null;
	viewUrl: string | null;
}

interface FeedResponse {
	count: number;
	limit: number;
	offset: number;
	documents: Document[];
}

function App() {
	const [documents, setDocuments] = useState<Document[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		async function fetchFeed() {
			try {
				const response = await fetch(`${API_URL}/feed`);
				if (!response.ok) {
					throw new Error("Failed to fetch feed");
				}
				const data: FeedResponse = await response.json();
				setDocuments(data.documents);
			} catch (err) {
				setError(err instanceof Error ? err.message : "Unknown error");
			} finally {
				setLoading(false);
			}
		}

		fetchFeed();
	}, []);

	const formatDate = (dateString: string | null) => {
		if (!dateString) return "Unknown date";
		return new Date(dateString).toLocaleDateString("en-US", {
			year: "numeric",
			month: "long",
			day: "numeric",
		});
	};

	const truncateText = (text: string | null, maxLength: number = 200) => {
		if (!text) return "";
		if (text.length <= maxLength) return text;
		return text.slice(0, maxLength) + "...";
	};

	if (loading) {
		return (
			<div className="container">
				<h1>Standard.site Documents</h1>
				<p className="loading">Loading documents...</p>
			</div>
		);
	}

	if (error) {
		return (
			<div className="container">
				<h1>Standard.site Documents</h1>
				<p className="error">Error: {error}</p>
			</div>
		);
	}

	return (
		<div className="container">
			<h1>Standard.site Documents</h1>
			<p className="subtitle">{documents.length} documents found</p>

			<div className="feed">
				{documents.map((doc) => (
					<article key={doc.uri} className="document-card">
						<h2>
							{doc.viewUrl ? (
								<a href={doc.viewUrl} target="_blank" rel="noopener noreferrer">
									{doc.title}
								</a>
							) : (
								doc.title
							)}
						</h2>
						<time dateTime={doc.publishedAt || undefined}>
							{formatDate(doc.publishedAt)}
						</time>
						{doc.textContent && (
							<p className="excerpt">{truncateText(doc.textContent)}</p>
						)}
						{doc.viewUrl && (
							<a
								href={doc.viewUrl}
								target="_blank"
								rel="noopener noreferrer"
								className="read-more"
							>
								Read on author's site
							</a>
						)}
					</article>
				))}
			</div>

			{documents.length === 0 && <p className="empty">No documents found.</p>}
		</div>
	);
}

export default App;
