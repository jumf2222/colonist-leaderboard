// @refresh reload
import { MetaProvider, Title } from '@solidjs/meta';
import { Router } from '@solidjs/router';
import { FileRoutes } from '@solidjs/start/router';
import { Loading } from 'solid-js';
import './app.css';

export default function App() {
	return (
		<Router
			root={(props) => (
				<MetaProvider>
					<Title>Colonist leaderboard</Title>
					<Loading>{props.children}</Loading>
				</MetaProvider>
			)}
		>
			<FileRoutes />
		</Router>
	);
}
