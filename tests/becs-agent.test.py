import importlib.util
import pathlib
import tempfile
import unittest
import datetime as dt

spec = importlib.util.spec_from_file_location('becs_agent', pathlib.Path(__file__).parents[1] / 'agents/becs/becs-agent.py')
agent = importlib.util.module_from_spec(spec)
spec.loader.exec_module(agent)


class AgentTests(unittest.TestCase):
    def test_unlock_is_offline_and_independent_of_credentials(self):
        with tempfile.TemporaryDirectory() as temp:
            directory = pathlib.Path(temp)
            agent.save(directory / 'applied-policy.json', {'revision': 1})
            agent.local_unlock(directory)
            self.assertFalse((directory / 'applied-policy.json').exists())
            self.assertTrue((directory / 'local-override.json').exists())

    def test_reject_expired_old_device_and_enforcing_policy(self):
        now = dt.datetime(2026, 11, 17, tzinfo=dt.timezone.utc)
        policy = {'device_id': 'mac', 'revision': 5, 'level': 'OBSERVE',
                  'issued_at': '2026-11-17T00:00:00Z', 'expires_at': '2026-11-17T00:02:00Z',
                  'domains': {'deny': []}, 'apps': {'terminate_only_if_safe': []}}
        command = {'device_id': 'mac', 'policy_revision': 5, 'policy': policy}
        self.assertTrue(agent.valid_policy(command, 'mac', 4, now))
        self.assertFalse(agent.valid_policy(command, 'other', 4, now))
        self.assertFalse(agent.valid_policy(command, 'mac', 6, now))
        self.assertFalse(agent.valid_policy(command, 'mac', 4, now + dt.timedelta(minutes=3)))
        policy['level'] = 'ENFORCE'
        self.assertFalse(agent.valid_policy(command, 'mac', 4, now))


if __name__ == '__main__':
    unittest.main()
