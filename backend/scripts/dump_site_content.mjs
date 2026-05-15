#!/usr/bin/env node
/**
 * Dumps each /app/frontend/src/site/content/*.js file as JSON to stdout
 * for the Python seed script to consume. Run via `node dump_site_content.mjs`.
 */
import { homepageContent } from '../../frontend/src/site/content/homepage.js';
import { projectCategories, projects } from '../../frontend/src/site/content/projects.js';
import { onboardingContent } from '../../frontend/src/site/content/onboarding.js';
import { professionalsContent } from '../../frontend/src/site/content/professionals.js';
import { navigationContent } from '../../frontend/src/site/content/navigation.js';
import { uiContent } from '../../frontend/src/site/content/ui.js';

process.stdout.write(JSON.stringify({
  home:           homepageContent,
  projects:       { categories: projectCategories, items: projects },
  start_project:  onboardingContent,
  professionals:  professionalsContent,
  navigation:     navigationContent,
  ui:             uiContent,
}, null, 2));
