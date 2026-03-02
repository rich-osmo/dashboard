import { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  useLongformPosts,
  useLongformPost,
  useCreateLongform,
  useUpdateLongform,
  useDeleteLongform,
  useLongformTags,
  useCreateLongformComment,
  useDeleteLongformComment,
  useAIEditLongform,
} from '../api/hooks';
import type { LongformComment } from '../api/types';
import { MarkdownRenderer } from '../components/shared/MarkdownRenderer';
import { TimeAgo } from '../components/shared/TimeAgo';

// --- Post Detail / Editor ---

function PostDetail({
  postId,
  onBack,
}: {
  postId: number;
  onBack: () => void;
}) {
  const { data: post, isLoading } = useLongformPost(postId);
  const updatePost = useUpdateLongform();
  const deletePost = useDeleteLongform();
  const createComment = useCreateLongformComment();
  const deleteComment = useDeleteLongformComment();
  const { data: allTags } = useLongformTags();
  const navigate = useNavigate();

  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [viewMode, setViewMode] = useState<'edit' | 'preview' | 'split'>('edit');
  const [commentText, setCommentText] = useState('');
  const [thoughtText, setThoughtText] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [aiHistory, setAIHistory] = useState<
    { instruction: string; commentary: string; revised_body: string }[]
  >([]);
  const [aiInstruction, setAIInstruction] = useState('');
  const [selectedText, setSelectedText] = useState('');
  const titleRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const aiEdit = useAIEditLongform();

  // Sync local state when post loads
  const postTitle = post?.title;
  const postBody = post?.body;
  const postIdLoaded = post?.id;
  useEffect(() => {
    if (postTitle !== undefined) setEditTitle(postTitle);
    if (postBody !== undefined) setEditBody(postBody);
  }, [postIdLoaded, postTitle, postBody]);

  const handleTitleBlur = useCallback(() => {
    if (post && editTitle !== post.title && editTitle.trim()) {
      updatePost.mutate({ id: post.id, title: editTitle.trim() });
    }
  }, [post, editTitle, updatePost]);

  const handleBodyBlur = useCallback(() => {
    if (post && editBody !== post.body) {
      updatePost.mutate({ id: post.id, body: editBody });
    }
  }, [post, editBody, updatePost]);

  const handleStatusToggle = useCallback(() => {
    if (!post) return;
    const newStatus = post.status === 'draft' ? 'published' : 'draft';
    updatePost.mutate({ id: post.id, status: newStatus });
  }, [post, updatePost]);

  const handleDelete = useCallback(() => {
    if (!post) return;
    if (confirm('Delete this post?')) {
      deletePost.mutate(post.id);
      onBack();
    }
  }, [post, deletePost, onBack]);

  const handleCopyMarkdown = useCallback(() => {
    if (!post) return;
    const md = `# ${post.title}\n\n${post.body}`;
    navigator.clipboard.writeText(md);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  }, [post]);

  const handleOpenInClaude = useCallback(() => {
    if (!post) return;
    navigate(`/claude?longform=${post.id}`);
  }, [post, navigate]);

  const handleAddTag = useCallback(
    (tag: string) => {
      if (!post) return;
      const t = tag.trim().toLowerCase();
      if (t && !post.tags.includes(t)) {
        updatePost.mutate({ id: post.id, tags: [...post.tags, t] });
      }
      setTagInput('');
      setShowTagDropdown(false);
    },
    [post, updatePost],
  );

  const handleRemoveTag = useCallback(
    (tag: string) => {
      if (!post) return;
      updatePost.mutate({ id: post.id, tags: post.tags.filter((t) => t !== tag) });
    },
    [post, updatePost],
  );

  const handleAddComment = useCallback(() => {
    if (!post || !commentText.trim()) return;
    createComment.mutate({ postId: post.id, text: commentText.trim(), is_thought: false });
    setCommentText('');
  }, [post, commentText, createComment]);

  const handleAddThought = useCallback(() => {
    if (!post || !thoughtText.trim()) return;
    createComment.mutate({ postId: post.id, text: thoughtText.trim(), is_thought: true });
    setThoughtText('');
  }, [post, thoughtText, createComment]);

  const handleDeleteComment = useCallback(
    (commentId: number) => {
      if (!post) return;
      deleteComment.mutate({ postId: post.id, commentId });
    },
    [post, deleteComment],
  );

  const handleTextSelect = useCallback(() => {
    if (bodyRef.current) {
      const start = bodyRef.current.selectionStart;
      const end = bodyRef.current.selectionEnd;
      setSelectedText(start !== end ? editBody.substring(start, end) : '');
    }
  }, [editBody]);

  const handleAIEdit = useCallback(() => {
    if (!post || !aiInstruction.trim()) return;

    const historyForContext = aiHistory.slice(-3).map((h) => ({
      instruction: h.instruction,
      commentary: h.commentary,
    }));

    aiEdit.mutate(
      {
        postId: post.id,
        instruction: aiInstruction.trim(),
        body: editBody,
        title: editTitle,
        selected_text: selectedText,
        history: historyForContext,
      },
      {
        onSuccess: (result) => {
          if (!result.error) {
            setAIHistory((prev) => [
              ...prev,
              {
                instruction: aiInstruction.trim(),
                commentary: result.commentary,
                revised_body: result.revised_body,
              },
            ]);
          }
          setAIInstruction('');
          setSelectedText('');
        },
      },
    );
  }, [post, aiInstruction, editBody, editTitle, selectedText, aiHistory, aiEdit]);

  const handleApplyAIEdit = useCallback(
    (revisedBody: string) => {
      setEditBody(revisedBody);
      if (post) {
        updatePost.mutate({ id: post.id, body: revisedBody });
      }
    },
    [post, updatePost],
  );

  const handleSaveAsThought = useCallback(
    (text: string) => {
      if (!post) return;
      createComment.mutate({ postId: post.id, text: `[AI] ${text}`, is_thought: true });
    },
    [post, createComment],
  );

  const filteredTags = (allTags || []).filter(
    (t) => t.includes(tagInput.toLowerCase()) && !(post?.tags || []).includes(t),
  );

  if (isLoading) return <p>Loading...</p>;
  if (!post) return <p>Post not found.</p>;

  return (
    <div className="longform-detail">
      <div className="longform-detail-header">
        <button className="longform-back-btn" onClick={onBack}>
          &larr; All Posts
        </button>
        <div className="longform-detail-actions">
          <button
            className={`longform-status-toggle ${post.status}`}
            onClick={handleStatusToggle}
          >
            {post.status === 'draft' ? 'Publish' : 'Unpublish'}
          </button>
          <button onClick={handleCopyMarkdown} title="Copy as Markdown">
            {copyFeedback ? 'Copied!' : 'Copy MD'}
          </button>
          <button onClick={handleOpenInClaude} title="Open in Claude">
            Open in Claude
          </button>
          <button className="longform-delete-btn" onClick={handleDelete}>
            Delete
          </button>
        </div>
      </div>

      {/* Title */}
      <input
        ref={titleRef}
        className="longform-title-input"
        value={editTitle}
        onChange={(e) => setEditTitle(e.target.value)}
        onBlur={handleTitleBlur}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            bodyRef.current?.focus();
          }
        }}
        placeholder="Post title..."
      />

      {/* Meta row */}
      <div className="longform-meta">
        <span className={`longform-status-badge ${post.status}`}>{post.status}</span>
        <span className="longform-word-count">{post.word_count} words</span>
        <span className="longform-date">
          Updated <TimeAgo date={post.updated_at} />
        </span>
        {post.claude_session_id && (
          <a href={`/claude?session=${post.claude_session_id}`} className="longform-session-link">
            From Claude session
          </a>
        )}
      </div>

      {/* Tags */}
      <div className="longform-tags-row">
        {post.tags.map((tag) => (
          <span key={tag} className="longform-tag-badge">
            {tag}
            <button onClick={() => handleRemoveTag(tag)}>&times;</button>
          </span>
        ))}
        <div className="longform-tag-input-wrapper">
          <input
            className="longform-tag-input"
            placeholder="Add tag..."
            value={tagInput}
            onChange={(e) => {
              setTagInput(e.target.value);
              setShowTagDropdown(true);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && tagInput.trim()) {
                e.preventDefault();
                handleAddTag(tagInput);
              }
              if (e.key === 'Escape') setShowTagDropdown(false);
            }}
            onFocus={() => setShowTagDropdown(true)}
            onBlur={() => setTimeout(() => setShowTagDropdown(false), 200)}
          />
          {showTagDropdown && filteredTags.length > 0 && (
            <div className="longform-tag-dropdown">
              {filteredTags.slice(0, 8).map((t) => (
                <div
                  key={t}
                  className="longform-tag-option"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleAddTag(t);
                  }}
                >
                  {t}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Body editor */}
      <div className="longform-editor-toolbar">
        <button className={viewMode === 'edit' ? 'active' : ''} onClick={() => setViewMode('edit')}>
          Edit
        </button>
        <button className={viewMode === 'preview' ? 'active' : ''} onClick={() => setViewMode('preview')}>
          Preview
        </button>
        <button className={viewMode === 'split' ? 'active' : ''} onClick={() => setViewMode('split')}>
          Split
        </button>
        {post.status === 'draft' && (
          <button
            className={`longform-ai-toggle ${showAIPanel ? 'active' : ''}`}
            onClick={() => setShowAIPanel((v) => !v)}
          >
            AI Editor
          </button>
        )}
      </div>

      <div className={`longform-editor-area ${viewMode}`}>
        {(viewMode === 'edit' || viewMode === 'split') && (
          <textarea
            ref={bodyRef}
            className="longform-body-textarea"
            value={editBody}
            onChange={(e) => setEditBody(e.target.value)}
            onBlur={handleBodyBlur}
            onSelect={handleTextSelect}
            onMouseUp={handleTextSelect}
            placeholder="Write your post in Markdown..."
          />
        )}
        {(viewMode === 'preview' || viewMode === 'split') && (
          <div className="longform-body-preview">
            <MarkdownRenderer content={editBody || '_No content yet._'} />
          </div>
        )}
      </div>

      {/* AI Editor Panel */}
      {showAIPanel && post.status === 'draft' && (
        <div className="longform-ai-panel">
          <h3>AI Editor</h3>

          {aiHistory.length > 0 && (
            <div className="longform-ai-history">
              {aiHistory.map((entry, i) => (
                <div key={i} className="longform-ai-exchange">
                  <div className="longform-ai-instruction">{entry.instruction}</div>
                  <div className="longform-ai-response">
                    <MarkdownRenderer content={entry.commentary} />
                    <div className="longform-ai-actions">
                      <button onClick={() => handleApplyAIEdit(entry.revised_body)}>
                        Apply Changes
                      </button>
                      <button onClick={() => handleSaveAsThought(entry.commentary)}>
                        Save as Thought
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {selectedText && (
            <div className="longform-ai-selection">
              Selected: &ldquo;
              {selectedText.length > 80 ? selectedText.slice(0, 80) + '...' : selectedText}
              &rdquo;
            </div>
          )}

          <div className="longform-ai-input">
            <input
              value={aiInstruction}
              onChange={(e) => setAIInstruction(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleAIEdit();
                }
              }}
              placeholder={
                selectedText
                  ? 'How should I edit the selected text?'
                  : "How should I edit this draft? (e.g., 'make the intro more compelling')"
              }
              disabled={aiEdit.isPending}
            />
            <button onClick={handleAIEdit} disabled={!aiInstruction.trim() || aiEdit.isPending}>
              {aiEdit.isPending ? 'Editing...' : 'Edit'}
            </button>
          </div>

          {aiEdit.data?.error && (
            <div className="longform-ai-error">{aiEdit.data.error}</div>
          )}

          {aiHistory.length > 0 && (
            <button className="longform-ai-clear" onClick={() => setAIHistory([])}>
              Clear history
            </button>
          )}
        </div>
      )}

      {/* Comments */}
      <div className="longform-comments-section">
        <h3>Comments ({post.comments?.length || 0})</h3>
        {post.comments?.map((c: LongformComment) => (
          <div key={c.id} className="longform-comment-item">
            <div className="longform-comment-text">{c.text}</div>
            <div className="longform-comment-meta">
              <TimeAgo date={c.created_at} />
              <button className="longform-comment-delete" onClick={() => handleDeleteComment(c.id)}>
                &times;
              </button>
            </div>
          </div>
        ))}
        <div className="longform-comment-add">
          <input
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleAddComment();
              }
            }}
            placeholder="Add a comment..."
          />
          <button onClick={handleAddComment} disabled={!commentText.trim()}>
            Add
          </button>
        </div>
      </div>

      {/* Thoughts */}
      <div className="longform-thoughts-section">
        <h3>Thoughts ({post.thoughts?.length || 0})</h3>
        {post.thoughts?.map((t: LongformComment) => (
          <div key={t.id} className="longform-comment-item thought">
            <div className="longform-comment-text">{t.text}</div>
            <div className="longform-comment-meta">
              <TimeAgo date={t.created_at} />
              <button className="longform-comment-delete" onClick={() => handleDeleteComment(t.id)}>
                &times;
              </button>
            </div>
          </div>
        ))}
        <div className="longform-comment-add">
          <input
            value={thoughtText}
            onChange={(e) => setThoughtText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleAddThought();
              }
            }}
            placeholder="Add a thought..."
          />
          <button onClick={handleAddThought} disabled={!thoughtText.trim()}>
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Post List ---

export function LongformPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const postIdParam = searchParams.get('postId');
  const selectedPostId = postIdParam ? parseInt(postIdParam, 10) : null;

  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [sortBy, setSortBy] = useState('updated_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const createPost = useCreateLongform();
  const { data: posts, isLoading } = useLongformPosts({
    status: statusFilter || undefined,
    tag: tagFilter || undefined,
    search: debouncedSearch || undefined,
    sort_by: sortBy || undefined,
    sort_dir: sortDir,
  });
  const { data: allTags } = useLongformTags();

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchText), 400);
    return () => clearTimeout(timer);
  }, [searchText]);

  const handleNewPost = useCallback(() => {
    createPost.mutate({ title: 'Untitled', body: '' }, {
      onSuccess: (newPost) => {
        setSearchParams({ postId: String(newPost.id) });
      },
    });
  }, [createPost, setSearchParams]);

  const handleSelectPost = useCallback(
    (id: number) => {
      setSearchParams({ postId: String(id) });
    },
    [setSearchParams],
  );

  const handleBack = useCallback(() => {
    setSearchParams({});
  }, [setSearchParams]);

  // If a specific post is selected, show detail view
  if (selectedPostId) {
    return <PostDetail postId={selectedPostId} onBack={handleBack} />;
  }

  // List view
  return (
    <div className="longform-page">
      <div className="longform-list-header">
        <h1>Longform</h1>
        <button className="longform-new-btn" onClick={handleNewPost} disabled={createPost.isPending}>
          + New Post
        </button>
      </div>

      {/* Filters */}
      <div className="longform-filters">
        <div className="longform-status-tabs">
          {[
            { value: '', label: 'All' },
            { value: 'draft', label: 'Drafts' },
            { value: 'published', label: 'Published' },
          ].map((s) => (
            <button
              key={s.value}
              className={statusFilter === s.value ? 'active' : ''}
              onClick={() => setStatusFilter(s.value)}
            >
              {s.label}
            </button>
          ))}
        </div>

        <input
          className="longform-search-input"
          type="text"
          placeholder="Search posts..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />

        {allTags && allTags.length > 0 && (
          <select
            className="longform-tag-filter"
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
          >
            <option value="">All tags</option>
            {allTags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        )}

        <select
          className="longform-sort-select"
          value={`${sortBy}:${sortDir}`}
          onChange={(e) => {
            const [by, dir] = e.target.value.split(':');
            setSortBy(by);
            setSortDir(dir as 'asc' | 'desc');
          }}
        >
          <option value="updated_at:desc">Recently updated</option>
          <option value="created_at:desc">Newest first</option>
          <option value="created_at:asc">Oldest first</option>
          <option value="title:asc">Title A-Z</option>
          <option value="title:desc">Title Z-A</option>
          <option value="word_count:desc">Longest first</option>
          <option value="word_count:asc">Shortest first</option>
        </select>
      </div>

      {/* Posts table */}
      {isLoading ? (
        <p>Loading...</p>
      ) : !posts || posts.length === 0 ? (
        <p className="longform-empty">No posts yet. Click &ldquo;+ New Post&rdquo; to get started.</p>
      ) : (
        <table className="longform-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Status</th>
              <th>Tags</th>
              <th>Words</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((post) => (
              <tr
                key={post.id}
                className="longform-table-row"
                onClick={() => handleSelectPost(post.id)}
              >
                <td className="longform-table-title">
                  {post.title}
                  {(post.comment_count > 0 || post.thought_count > 0) && (
                    <span className="longform-table-counts">
                      {post.comment_count > 0 && ` ${post.comment_count}c`}
                      {post.thought_count > 0 && ` ${post.thought_count}t`}
                    </span>
                  )}
                </td>
                <td>
                  <span className={`longform-status-badge ${post.status}`}>{post.status}</span>
                </td>
                <td className="longform-table-tags">
                  {post.tags.map((t) => (
                    <span key={t} className="longform-tag-badge small">
                      {t}
                    </span>
                  ))}
                </td>
                <td className="longform-table-words">{post.word_count}</td>
                <td className="longform-table-date">
                  <TimeAgo date={post.updated_at} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
