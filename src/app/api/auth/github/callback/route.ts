import { GithubOAuthService } from "@/backend/services/oauth/GithubOAuthService";
import * as sessionActions from "@/backend/services/session.actions";
import * as userActions from "@/backend/services/user.action";
import { NextResponse } from "next/server";

const githubOAuthService = new GithubOAuthService();

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const afterAuthRedirect = await sessionActions.getAfterAuthRedirect();

  if (code === null || state === null) {
    return NextResponse.json({ error: "Please restart the process." });
  }

  const githubUser = await githubOAuthService.getUserInfo(code!, state!);
  if (!githubUser.success) {
    return NextResponse.json(
      { error: githubUser.error, type: `Can't fetch github user` },
      { status: 500 }
    );
  }

  const bootedSocialUser = await userActions.bootSocialUser({
    service: "github",
    service_uid: githubUser?.data.id?.toString(),
    name: githubUser?.data?.login,
    username: githubUser?.data?.login,
    email: githubUser?.data.email,
    profile_photo: githubUser?.data?.avatar_url,
    bio: githubUser?.data?.bio ?? "",
  });

  if (!bootedSocialUser.success) {
    return NextResponse.json(
      { error: bootedSocialUser.error },
      { status: 500 }
    );
  }

  await sessionActions.createLoginSession({
    user_id: bootedSocialUser.data?.user.id!,
    request,
  });

  if (afterAuthRedirect) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: afterAuthRedirect ?? "/",
      },
    });
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: "/",
    },
  });
}
