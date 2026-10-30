-- Backfill Data API grants for legacy tables created before the grant requirement.
GRANT SELECT, INSERT, UPDATE, DELETE ON PUBLIC.problems, PUBLIC.analyses, PUBLIC.hints, PUBLIC.solutions, PUBLIC.test_cases, PUBLIC.learning_history, PUBLIC.user_problem_progress, PUBLIC.contest_results, PUBLIC.execution_history, PUBLIC.user_achievements, PUBLIC.custom_problems, PUBLIC.interview_results, PUBLIC.shared_solutions, PUBLIC.user_code_saves, PUBLIC.discussion_posts, PUBLIC.agent_runs, PUBLIC.system_patch_proposals, PUBLIC.issues, PUBLIC.issue_messages, PUBLIC.direct_messages, PUBLIC.interview_lobbies, PUBLIC.lobby_messages, PUBLIC.lobby_participants TO authenticated;
GRANT ALL ON PUBLIC.problems, PUBLIC.analyses, PUBLIC.hints, PUBLIC.solutions, PUBLIC.test_cases, PUBLIC.learning_history, PUBLIC.user_problem_progress, PUBLIC.contest_results, PUBLIC.execution_history, PUBLIC.user_achievements, PUBLIC.custom_problems, PUBLIC.interview_results, PUBLIC.shared_solutions, PUBLIC.user_code_saves, PUBLIC.discussion_posts, PUBLIC.agent_runs, PUBLIC.system_patch_proposals, PUBLIC.issues, PUBLIC.issue_messages, PUBLIC.direct_messages, PUBLIC.interview_lobbies, PUBLIC.lobby_messages, PUBLIC.lobby_participants TO service_role;

GRANT SELECT ON PUBLIC.profiles TO authenticated, anon;
GRANT UPDATE, INSERT ON PUBLIC.profiles TO authenticated;
GRANT ALL ON PUBLIC.profiles TO service_role;
GRANT SELECT ON PUBLIC.public_profile_stats TO authenticated;
GRANT SELECT ON PUBLIC.daily_questions_public TO authenticated, anon;
GRANT SELECT ON PUBLIC.user_roles TO authenticated;
GRANT ALL ON PUBLIC.user_roles TO service_role;

-- RPCs used by the app from the browser
GRANT EXECUTE ON FUNCTION PUBLIC.admin_delete_user(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION PUBLIC.admin_reset_password(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION PUBLIC.admin_reset_username(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION PUBLIC.admin_update_user_role(UUID, PUBLIC.app_role) TO authenticated, service_role;