<?php

/*
 * This file is part of the Claroline Connect package.
 *
 * (c) Claroline Consortium <consortium@claroline.net>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace Claroline\ChatBundle\Controller;

use Claroline\ChatBundle\Entity\ChatUser;
use Claroline\ChatBundle\Form\ChatConfigurationType;
use Claroline\ChatBundle\Form\ChatUserEditionType;
use Claroline\ChatBundle\Manager\ChatManager;
use Claroline\CoreBundle\Entity\User;
use Claroline\CoreBundle\Library\Configuration\PlatformConfigurationHandler;
use Claroline\CoreBundle\Library\Utilities\ClaroUtilities;
use JMS\DiExtraBundle\Annotation as DI;
use JMS\SecurityExtraBundle\Annotation as SEC;
use Sensio\Bundle\FrameworkExtraBundle\Configuration as EXT;
use Symfony\Bundle\FrameworkBundle\Controller\Controller;
use Symfony\Component\Form\FormFactory;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\RedirectResponse;
use Symfony\Component\HttpFoundation\RequestStack;
use Symfony\Component\Routing\RouterInterface;
use Symfony\Component\Translation\TranslatorInterface;

/**
 * @DI\Tag("security.secure_service")
 * @SEC\PreAuthorize("canOpenAdminTool('claroline_chat_management_admin_tool')")
 */
class AdminChatController extends Controller
{
    private $chatManager;
    private $claroUtils;
    private $formFactory;
    private $platformConfigHandler;
    private $request;
    private $router;
    private $translator;

    /**
     * @DI\InjectParams({
     *     "chatManager"           = @DI\Inject("claroline.manager.chat_manager"),
     *     "claroUtils"            = @DI\Inject("claroline.utilities.misc"),
     *     "formFactory"           = @DI\Inject("form.factory"),
     *     "platformConfigHandler" = @DI\Inject("claroline.config.platform_config_handler"),
     *     "requestStack"          = @DI\Inject("request_stack"),
     *     "router"                = @DI\Inject("router"),
     *     "translator"            = @DI\Inject("translator")
     * })
     */
    public function __construct(
        ChatManager $chatManager,
        ClaroUtilities $claroUtils,
        FormFactory $formFactory,
        PlatformConfigurationHandler $platformConfigHandler,
        RequestStack $requestStack,
        RouterInterface $router,
        TranslatorInterface $translator
    )
    {
        $this->chatManager = $chatManager;
        $this->claroUtils = $claroUtils;
        $this->formFactory = $formFactory;
        $this->platformConfigHandler = $platformConfigHandler;
        $this->request = $requestStack->getCurrentRequest();
        $this->router = $router;
        $this->translator = $translator;
    }

    /**
     * @EXT\Route(
     *     "/admin/chat/management",
     *     name="claro_chat_admin_management",
     *     options={"expose"=true}
     * )
     * @EXT\ParamConverter("authenticatedUser", options={"authenticatedUser" = true})
     * @EXT\Template()
     */
    public function adminChatManagementAction()
    {

        return array();
    }

    /**
     * @EXT\Route(
     *     "/admin/chat/configure/form",
     *     name="claro_chat_admin_configure_form"
     * )
     * @EXT\ParamConverter("authenticatedUser", options={"authenticatedUser" = true})
     * @EXT\Template()
     */
    public function adminChatConfigureFormAction()
    {
        $form = $this->formFactory->create(
            new ChatConfigurationType($this->platformConfigHandler)
        );

        return array('form' => $form->createView());
    }

    /**
     * @EXT\Route(
     *     "/admin/chat/configure",
     *     name="claro_chat_admin_configure"
     * )
     * @EXT\ParamConverter("authenticatedUser", options={"authenticatedUser" = true})
     */
    public function adminChatConfigureAction()
    {
        $formData = $this->request->get('chat_configuration_form');
        $host = $formData['host'];
        $mucHost = $formData['mucHost'];
        $port = $formData['port'];
        $iceServers = $formData['iceServers'];
        $disableChatRoomAudio = isset($formData['disableChatRoomAudio']) ? true : false;
        $disableChatRoomVideo = isset($formData['disableChatRoomVideo']) ? true : false;
        $this->platformConfigHandler->setParameters(
            array(
                'chat_xmpp_host' => $host,
                'chat_xmpp_muc_host' => $mucHost,
                'chat_bosh_port' => $port,
                'chat_ice_servers' => $iceServers,
                'chat_room_audio_disable' => $disableChatRoomAudio,
                'chat_room_video_disable' => $disableChatRoomVideo
            )
        );

        return new RedirectResponse(
            $this->router->generate('claro_chat_admin_management')
        );
    }

    /**
     * @EXT\Route(
     *     "/admin/chat/users/management/{show}/page/{page}/max/{max}/ordered/by/{orderedBy}/order/{order}/search/{search}",
     *     name="claro_chat_users_admin_management",
     *     defaults={"show"=0, "page"=1, "search"="", "max"=50, "orderedBy"="username","order"="ASC"},
     *     options={"expose"=true}
     * )
     * @EXT\ParamConverter("authenticatedUser", options={"authenticatedUser" = true})
     * @EXT\Template()
     */
    public function adminChatUsersManagementAction(
        $show = 0,
        $search = '',
        $page = 1,
        $max = 50,
        $orderedBy = 'username',
        $order = 'ASC'
    )
    {
        $chatUsers = array();

        if ($show !== 0) {
            $chatUsers = $this->chatManager->getChatUsers(
                $search,
                $orderedBy,
                $order,
                true,
                $page,
                $max
            );
        }
        $xmppHost = $this->platformConfigHandler->getParameter('chat_xmpp_host');
        $boshPort = $this->platformConfigHandler->getParameter('chat_bosh_port');

        return array(
            'chatUsers' => $chatUsers,
            'show' => $show,
            'search' => $search,
            'page' => $page,
            'max' => $max,
            'orderedBy' => $orderedBy,
            'order' => $order,
            'xmppHost' => $xmppHost,
            'boshPort' => $boshPort
        );
    }

    /**
     * @EXT\Route(
     *     "/admin/chat/users/list/type/{type}",
     *     name="claro_chat_users_list",
     *     defaults={"type"="none"},
     *     options={"expose"=true}
     * )
     * @EXT\ParamConverter("authenticatedUser", options={"authenticatedUser" = true})
     */
    public function chatUsersListAction($type = 'none')
    {
        $datas = array();
        $users = $this->chatManager->getAllUsersFromChatUsers();

        switch ($type) {

            case 'id':

                foreach ($users as $user) {
                    $datas[] = $user->getId();
                }
                break;

            default:
                $datas = $users;
                break;
        }

        return new JsonResponse($datas, 200);
    }

    /**
     * @EXT\Route(
     *     "/admin/chat/user/{user}/username/{username}/password/{password}/create",
     *     name="claro_chat_user_create",
     *     options={"expose"=true}
     * )
     * @EXT\ParamConverter("authenticatedUser", options={"authenticatedUser" = true})
     */
    public function chatUsersCreateFormAction(User $user, $username, $password)
    {
        $this->chatManager->createChatUser($user, $username, $password);

        return new JsonResponse('success', 200);
    }

    /**
     * @EXT\Route(
     *     "/admin/chat/user/{chatUser}/edit/form",
     *     name="claro_chat_user_edit_form",
     *     options={"expose"=true}
     * )
     * @EXT\ParamConverter("authenticatedUser", options={"authenticatedUser" = true})
     * @EXT\Template("ClarolineChatBundle:AdminChat:chatUserEditModalForm.html.twig")
     */
    public function chatUserEditFormAction(ChatUser $chatUser)
    {
        $options = $chatUser->getOptions();
        $color = isset($options['color']) ? $options['color'] : null;

        $form = $this->formFactory->create(
            new ChatUserEditionType($color)
        );

        return array('form' => $form->createView());
    }

    /**
     * @EXT\Route(
     *     "/admin/chat/user/{chatUser}/edit",
     *     name="claro_chat_user_edit",
     *     options={"expose"=true}
     * )
     * @EXT\ParamConverter("authenticatedUser", options={"authenticatedUser" = true})
     * @EXT\Template("ClarolineChatBundle:AdminChat:chatUserEditModalForm.html.twig")
     */
    public function chatUserEditAction(ChatUser $chatUser)
    {
        $options = $chatUser->getOptions();
        $color = isset($options['color']) ? $options['color'] : null;

        $form = $this->formFactory->create(
            new ChatUserEditionType($color)
        );
        $form->handleRequest($this->request);

        if ($form->isValid()) {
            $newColor = $form->get('color')->getData();

            if (is_null($options)) {
                $options = array('color' => $newColor);
            } else {
                $options['color'] = $newColor;
            }
            $chatUser->setOptions($options);
            $this->chatManager->persistChatUser($chatUser);

            return new JsonResponse('success', 200);
        } else {

            return array('form' => $form->createView());
        }
    }
}
