import { state } from '../state.js';
import { getAllProjects, saveProjectMeta, deleteProject } from '../db.js';
import { loadState, scheduleSave, saveState } from '../storage.js';

export function init() {
    const projectsBtn = document.getElementById('projects-btn');
    const projectsModal = document.getElementById('projects-modal');
    const closeProjectsModal = document.getElementById('close-projects-modal');
    const projectsGrid = document.getElementById('projects-grid');
    const newProjectCard = document.getElementById('new-project-card');

    const renameModal = document.getElementById('project-rename-modal');
    const closeRenameModal = document.getElementById('close-rename-modal');
    const renameInput = document.getElementById('rename-project-input');
    const confirmRenameBtn = document.getElementById('confirm-rename-btn');

    let projectToRename = null;

    projectsBtn?.addEventListener('click', async () => {
        // Ensure current project has a fresh preview before showing the list
        await saveState(true); 
        renderProjects();
        projectsModal.classList.remove('hidden');
    });

    closeProjectsModal?.addEventListener('click', () => {
        projectsModal.classList.add('hidden');
    });

    newProjectCard?.addEventListener('click', async () => {
        // Save current before creating new
        await saveState(true);

        const id = 'project-' + Date.now();
        const meta = {
            id: id,
            name: 'New Project',
            updatedAt: Date.now(),
            preview: null
        };
        await saveProjectMeta(meta);
        await switchProject(id);
        projectsModal.classList.add('hidden');
    });

    async function switchProject(id) {
        // Save current with preview before switching
        await saveState(true);
        
        // Show loading
        const loading = document.getElementById('loading-overlay');
        if (loading) {
            document.getElementById('loading-text').textContent = 'Loading Project...';
            loading.classList.remove('hidden');
        }

        await loadState(id);
        
        if (loading) loading.classList.add('hidden');
        
        window.dispatchEvent(new CustomEvent('requestSyncUI'));
    }

    async function renderProjects() {
        const projects = await getAllProjects();
        
        // Sort by updatedAt descending
        projects.sort((a, b) => b.updatedAt - a.updatedAt);

        // Keep the "New Project" card
        const newCard = document.getElementById('new-project-card');
        projectsGrid.innerHTML = '';
        projectsGrid.appendChild(newCard);

        projects.forEach(project => {
            const card = document.createElement('div');
            card.className = 'project-card';
            if (project.id === state.currentProjectId) {
                card.classList.add('active');
            }

            const updatedAt = new Date(project.updatedAt).toLocaleDateString() + ' ' + new Date(project.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            card.innerHTML = `
                <div class="project-preview-vibe">
                    ${project.preview ? `<img src="${project.preview}" alt="Preview">` : '<div style="color:#ccc; font-size: 10px;">No Preview</div>'}
                </div>
                <div class="project-card-info">
                    <span class="project-name">${project.name || 'Untitled'}</span>
                    <span class="project-meta">${updatedAt}</span>
                </div>
                <div class="project-actions">
                    <button class="project-action-btn edit-name" title="Rename">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                    ${project.id !== 'default-project' ? `
                    <button class="project-action-btn delete" title="Delete">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>` : ''}
                </div>
            `;

            card.addEventListener('click', (e) => {
                if (e.target.closest('.project-action-btn')) return;
                switchProject(project.id);
                projectsModal.classList.add('hidden');
            });

            const editBtn = card.querySelector('.edit-name');
            editBtn.addEventListener('click', () => {
                projectToRename = project;
                renameInput.value = project.name || '';
                renameModal.classList.remove('hidden');
                renameInput.focus();
                renameInput.select();
            });

            const delBtn = card.querySelector('.delete');
            delBtn?.addEventListener('click', async () => {
                if (confirm(`Delete project "${project.name}"? This cannot be undone.`)) {
                    await deleteProject(project.id);
                    if (state.currentProjectId === project.id) {
                        await switchProject('default-project');
                    }
                    renderProjects();
                }
            });

            projectsGrid.appendChild(card);
        });
    }

    closeRenameModal?.addEventListener('click', () => renameModal.classList.add('hidden'));
    
    confirmRenameBtn?.addEventListener('click', async () => {
        if (projectToRename && renameInput.value.trim()) {
            projectToRename.name = renameInput.value.trim();
            await saveProjectMeta(projectToRename);
            renameModal.classList.add('hidden');
            renderProjects();
            
            // If current project was renamed, maybe update some UI if we added it
        }
    });

    // Close on escape
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            projectsModal?.classList.add('hidden');
            renameModal?.classList.add('hidden');
        }
    });
}
