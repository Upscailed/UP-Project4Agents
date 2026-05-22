/**
 * MCP tool definitions + dispatcher.
 * Gedeeld tussen stdio-server en HTTP-endpoint.
 */
import {
  listProjects, createProject, getProject,
  listIssues, getIssue, createIssue, updateIssue, deleteIssue,
  getNextIssue, claimIssue, generateBranchName,
  listComments, createComment,
  listLinks, createLink, listSubIssues,
  listCycles, createCycle,
  listActivity, listViews,
  getStats, applyGithubPrEvent,
} from './db';

export const MCP_TOOLS = [
  { name: 'list_projects', description: 'Lijst alle projecten op.', inputSchema: { type: 'object', properties: {} } },
  { name: 'create_project', description: 'Maak een nieuw project aan.',
    inputSchema: { type: 'object', required: ['name'],
      properties: { name: { type: 'string' }, description: { type: 'string' }, color: { type: 'string' } } } },
  { name: 'list_issues', description: 'Lijst issues op met filters.',
    inputSchema: { type: 'object',
      properties: {
        project_id: { type: 'string' },
        status: { type: 'string', description: 'comma-separated: backlog,todo,in_progress,in_review,done,cancelled,triage' },
        priority: { type: 'string', description: 'comma-separated: urgent,high,medium,low,none' },
        assignee: { type: 'string' },
        cycle_id: { type: 'string' },
        parent_issue_id: { type: 'string' },
        search: { type: 'string' },
      } } },
  { name: 'get_issue', description: 'Haal één issue op met sub-issues + parent-project (incl. github_repo). Accepteert UUID of identifier (UP-42). Belangrijk: kijk naar project.github_repo om te weten welke GitHub-repo bij dit issue hoort. Als die leeg is, vraag de user bij welke repo het hoort voor je een branch maakt.',
    inputSchema: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } },
  { name: 'get_project', description: 'Haal een project op (incl. github_repo). Handig om te weten welke GitHub-repo bij een project hoort.',
    inputSchema: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } },
  { name: 'get_next_issue', description: 'Volgende taak: hoogste prio, niet geblokkeerd.',
    inputSchema: { type: 'object', properties: { assignee: { type: 'string' }, project_id: { type: 'string' } } } },
  { name: 'claim_issue', description: 'Atomic claim: status=in_progress + assignee + comment.',
    inputSchema: { type: 'object', required: ['id', 'assignee'],
      properties: { id: { type: 'string' }, assignee: { type: 'string' }, comment: { type: 'string' } } } },
  { name: 'create_issue', description: 'Maak een nieuwe issue (sub via parent_issue_id).',
    inputSchema: { type: 'object', required: ['project_id', 'title'],
      properties: {
        project_id: { type: 'string' }, title: { type: 'string' }, description: { type: 'string' },
        status: { type: 'string' }, priority: { type: 'string' },
        labels: { type: 'array', items: { type: 'string' } },
        acceptance_criteria: { type: 'string' }, assignee: { type: 'string' },
        parent_issue_id: { type: 'string' }, estimate: { type: 'number' },
        due_date: { type: 'string' }, cycle_id: { type: 'string' },
        github_branch: { type: 'string' },
      } } },
  { name: 'update_issue', description: 'Werk een issue bij. Alle velden optioneel.',
    inputSchema: { type: 'object', required: ['id'],
      properties: {
        id: { type: 'string' }, title: { type: 'string' }, description: { type: 'string' },
        status: { type: 'string' }, priority: { type: 'string' },
        labels: { type: 'array', items: { type: 'string' } },
        acceptance_criteria: { type: 'string' }, assignee: { type: 'string' },
        parent_issue_id: { type: ['string', 'null'] }, estimate: { type: ['number', 'null'] },
        due_date: { type: ['string', 'null'] }, cycle_id: { type: ['string', 'null'] },
        github_branch: { type: 'string' }, github_pr_url: { type: 'string' },
      } } },
  { name: 'delete_issue', description: 'Verwijder een issue (cascade).',
    inputSchema: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } },
  { name: 'add_comment', description: 'Voeg een comment / activity toe.',
    inputSchema: { type: 'object', required: ['issue_id', 'body'],
      properties: { issue_id: { type: 'string' }, author: { type: 'string' }, body: { type: 'string' } } } },
  { name: 'list_comments', description: 'Comments van een issue.',
    inputSchema: { type: 'object', required: ['issue_id'], properties: { issue_id: { type: 'string' } } } },
  { name: 'get_branch_name', description: 'Branch-naam suggestie incl. complete git-commando\'s en repo-info. Returnt: branch_name, repo (owner/repo of null), clone_url, git_commands (array van shell-commando\'s om de branch op te zetten). Als project.github_repo leeg is, returnt 't alleen de branch-naam — vraag dan eerst de user welke repo.',
    inputSchema: { type: 'object', required: ['id'],
      properties: { id: { type: 'string' }, prefix: { type: 'string' } } } },
  { name: 'link_issues', description: 'Koppel twee issues (blocks/blocked_by/relates_to/duplicates).',
    inputSchema: { type: 'object', required: ['from_id', 'to_id', 'link_type'],
      properties: {
        from_id: { type: 'string' }, to_id: { type: 'string' },
        link_type: { type: 'string', enum: ['blocks', 'blocked_by', 'relates_to', 'duplicates'] },
      } } },
  { name: 'get_issue_links', description: 'Lijst links van een issue.',
    inputSchema: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } },
  { name: 'get_sub_issues', description: 'Sub-issues (children) van een parent.',
    inputSchema: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } },
  { name: 'list_cycles', description: 'Lijst cycles (sprints).',
    inputSchema: { type: 'object', properties: { team_id: { type: 'string' } } } },
  { name: 'create_cycle', description: 'Maak een nieuwe cycle.',
    inputSchema: { type: 'object', required: ['name', 'starts_at', 'ends_at'],
      properties: {
        name: { type: 'string' }, description: { type: 'string' },
        starts_at: { type: 'string', description: 'YYYY-MM-DD' },
        ends_at: { type: 'string', description: 'YYYY-MM-DD' },
        team_id: { type: 'string' },
      } } },
  { name: 'get_activity', description: 'Activity log van issue/project.',
    inputSchema: { type: 'object',
      properties: { issue_id: { type: 'string' }, project_id: { type: 'string' }, limit: { type: 'number' } } } },
  { name: 'list_views', description: 'Lijst opgeslagen views/filters.',
    inputSchema: { type: 'object', properties: {} } },
  { name: 'get_stats', description: 'Statistieken: totaal issues, per status/priority/assignee.',
    inputSchema: { type: 'object', properties: {} } },
];

export async function executeToolByName(name: string, args: any): Promise<any> {
  args = args || {};
  switch (name) {
    case 'list_projects': return await listProjects();
    case 'create_project': return await createProject(args);

    case 'list_issues': {
      const filters: any = {};
      if (args.project_id) filters.project_id = args.project_id;
      if (args.status) filters.status = args.status.includes(',') ? args.status.split(',') : args.status;
      if (args.priority) filters.priority = args.priority.includes(',') ? args.priority.split(',') : args.priority;
      if (args.assignee !== undefined) filters.assignee = args.assignee;
      if (args.cycle_id) filters.cycle_id = args.cycle_id;
      if (args.parent_issue_id) filters.parent_issue_id = args.parent_issue_id;
      if (args.search) filters.search = args.search;
      return await listIssues(filters);
    }
    case 'get_issue': {
      const issue = await getIssue(args.id);
      if (!issue) throw new Error('Issue not found');
      const subs = await listSubIssues(issue.id);
      const project = await getProject(issue.project_id);
      return {
        ...issue,
        sub_issues: subs,
        project: project ? {
          id: project.id,
          name: project.name,
          color: project.color,
          github_repo: project.github_repo || null,
          repo_link: project.github_repo ? `https://github.com/${project.github_repo}` : null,
        } : null,
      };
    }
    case 'get_project': {
      const p = await getProject(args.id);
      if (!p) throw new Error('Project not found');
      return {
        ...p,
        github_repo: p.github_repo || null,
        repo_link: p.github_repo ? `https://github.com/${p.github_repo}` : null,
      };
    }
    case 'get_next_issue':
      return await getNextIssue({ assignee: args.assignee, project_id: args.project_id });
    case 'claim_issue':
      return await claimIssue(args.id, { assignee: args.assignee, comment: args.comment });
    case 'create_issue': return await createIssue(args);
    case 'update_issue': {
      const { id, ...patch } = args;
      return await updateIssue(id, patch);
    }
    case 'delete_issue': return { deleted: await deleteIssue(args.id) };

    case 'add_comment':
      return await createComment({ issue_id: args.issue_id, author: args.author, body: args.body });
    case 'list_comments': return await listComments(args.issue_id);

    case 'get_branch_name': {
      const issue = await getIssue(args.id);
      if (!issue) throw new Error('Issue not found');
      const branch = await generateBranchName(args.id, args.prefix);
      const project = await getProject(issue.project_id);
      const repo = project?.github_repo || null;

      if (!repo) {
        return {
          identifier: issue.identifier,
          branch_name: branch,
          repo: null,
          guidance: `Dit project (${project?.name || 'onbekend'}) heeft nog geen GitHub-repo gekoppeld. Vraag de user welke repo bij dit project hoort vóór je een branch maakt. De user kan 't toevoegen via Settings → Project bewerken, of je kunt 't via update_project zelf zetten.`,
        };
      }

      return {
        identifier: issue.identifier,
        branch_name: branch,
        repo,
        repo_link: `https://github.com/${repo}`,
        clone_url: `git@github.com:${repo}.git`,
        clone_url_https: `https://github.com/${repo}.git`,
        git_commands: [
          `# vanuit een bestaande clone van ${repo}:`,
          `git fetch origin && git checkout main && git pull`,
          `git checkout -b ${branch}`,
          `# ...maak je wijzigingen, daarna:`,
          `git push -u origin ${branch}`,
          `gh pr create --title "${issue.identifier}: ${issue.title}" --body "Fixes ${issue.identifier}"`,
        ],
        pr_title_suggestion: `${issue.identifier}: ${issue.title}`,
        pr_body_suggestion: `Fixes ${issue.identifier}\n\n${issue.description || ''}`,
      };
    }

    case 'link_issues': {
      const from = await getIssue(args.from_id);
      const to = await getIssue(args.to_id);
      if (!from || !to) throw new Error('Issue not found');
      return await createLink({ from_issue_id: from.id, to_issue_id: to.id, link_type: args.link_type });
    }
    case 'get_issue_links': return await listLinks(args.id);
    case 'get_sub_issues': return await listSubIssues(args.id);

    case 'list_cycles': return await listCycles(args.team_id);
    case 'create_cycle': return await createCycle(args);

    case 'get_activity':
      return await listActivity({ issue_id: args.issue_id, project_id: args.project_id, limit: args.limit });
    case 'list_views': return await listViews();
    case 'get_stats': return await getStats();

    default: throw new Error(`Unknown tool: ${name}`);
  }
}
